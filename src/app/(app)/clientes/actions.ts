"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { matchProvince } from "@/lib/normalize";
import { PLANS, type PlanId } from "@/lib/plans";
import { firstMessage } from "@/lib/services/clientAi";

function parse(formData: FormData) {
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const num = (k: string, d: number | null) => (g(k) === "" ? d : Number(g(k).replace(",", ".")));
  const list = (k: string) => g(k).split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);
  const vertical = ["luz", "placas"].includes(g("vertical")) ? g("vertical") : "lso";
  // Los planes son de despachos; luz y placas siempre van con precios propios
  const plan = vertical === "lso" && g("plan") in PLANS ? PLANS[g("plan") as PlanId] : null;
  const energy = vertical !== "lso";
  return {
    vertical,
    brand: g("brand") || null,
    web_form_ids: list("web_form_ids"),
    price_per_lead: energy ? num("price_per_lead", null) : null,
    price_per_sale: energy ? num("price_per_sale", null) : null,
    sale_commission_pct: energy ? num("sale_commission_pct", null) : null,
    min_monthly_bill: energy ? num("min_monthly_bill", null) : null,
    accept_hours: Math.max(1, Math.round(num("accept_hours", 72) ?? 72)),
    plan: plan ? g("plan") : "personalizado",
    name: g("name"),
    contact_name: g("contact_name") || null,
    contact_phone: g("contact_phone") || null,
    contact_email: g("contact_email") || null,
    notify_email: g("notify_email") || null,
    city: g("city") || null,
    provinces: list("provinces").map((p) => matchProvince(p) ?? p),
    status: ["activo", "pausado", "baja"].includes(g("status")) ? g("status") : "activo",
    monthly_fee: plan ? plan.fee : energy ? num("monthly_fee_energia", 0) : num("monthly_fee", 500),
    price_per_consultation: plan ? plan.perConsultation : energy ? 0 : num("price_per_consultation", 40),
    max_billable_per_month: num("max_billable_per_month", null),
    min_debt: num("min_debt", 8000),
    min_creditors: num("min_creditors", 2),
    calendar_url: g("calendar_url") || null,
    meta_form_ids: list("meta_form_ids"),
    google_form_ids: list("google_form_ids"),
    started_at: g("started_at") || new Date().toISOString().slice(0, 10),
    notes: g("notes") || null,
    ad_spend_month: num("ad_spend_month", null),
    google_review_url: /^https:\/\//.test(g("google_review_url")) ? g("google_review_url") : null,
  };
}

const COLS = [
  "plan", "name", "contact_name", "contact_phone", "contact_email", "notify_email", "city", "provinces", "status", "monthly_fee",
  "price_per_consultation", "max_billable_per_month", "min_debt", "min_creditors", "calendar_url", "meta_form_ids",
  "google_form_ids", "started_at", "notes", "ad_spend_month", "google_review_url",
  "vertical", "brand", "web_form_ids", "price_per_lead", "price_per_sale", "sale_commission_pct", "min_monthly_bill", "accept_hours",
] as const;

/** Premium = exclusividad: ningún otro cliente activo con Premium en la misma provincia. */
async function checkExclusivity(d: ReturnType<typeof parse>, id: string | null) {
  if (d.status !== "activo" || d.vertical !== "lso") return; // la exclusividad provincial es solo de despachos
  const clash = await queryOne<{ name: string; provinces: string[] }>(
    `SELECT name, provinces FROM clients
      WHERE status = 'activo' AND vertical = 'lso' AND ($1::uuid IS NULL OR id <> $1)
        AND ((plan = 'premium' AND (provinces && $2::text[] OR cardinality(provinces) = 0))
          OR ($3 = 'premium' AND (provinces && $2::text[] OR cardinality($2::text[]) = 0)))
      LIMIT 1`,
    [id, d.provinces, d.plan],
  );
  if (clash) throw new Error(`Choca con la exclusividad provincial de ${clash.name} (${clash.provinces.join(", ") || "toda España"}).`);
}

export async function createClient(formData: FormData) {
  await requireAdmin();
  const d = parse(formData);
  await checkExclusivity(d, null);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO clients(${COLS.join(",")}) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`,
    COLS.map((c) => d[c]),
  );
  const aiError = await firstMessage("despacho", row!.id, String(formData.get("ia") ?? ""));
  redirect(`/clientes/${row!.id}?nuevo=1${aiError ? `&ia=${encodeURIComponent(aiError)}` : ""}`);
}

export async function updateClient(id: string, formData: FormData) {
  await requireAdmin();
  const d = parse(formData);
  await checkExclusivity(d, id);
  await query(
    `UPDATE clients SET ${COLS.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
    [id, ...COLS.map((c) => d[c])],
  );
  // los criterios pueden haber cambiado: recualificar leads abiertos
  const open = await query<{ id: string }>("SELECT id FROM leads WHERE client_id = $1 AND status IN ('nuevo','no_contesta','volver_a_llamar')", [id]);
  const { requalify } = await import("@/lib/services/leads");
  for (const l of open) await requalify(l.id);
  revalidatePath(`/clientes/${id}`);
}

export async function rotateClientKey(id: string) {
  await requireAdmin();
  await query("UPDATE clients SET api_key = encode(gen_random_bytes(18),'hex') WHERE id = $1", [id]);
  revalidatePath(`/clientes/${id}`);
}

export async function rotatePortalToken(id: string) {
  await requireAdmin();
  await query("UPDATE clients SET portal_token = encode(gen_random_bytes(24),'hex') WHERE id = $1", [id]);
  revalidatePath(`/clientes/${id}`);
}

const pick = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v) ?? null;

/** Importa leads antiguos del despacho (CSV) para volver a llamarlos. Entran en la cola detrás de los de anuncios. */
export async function importOldLeads(id: string, _prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  if (formData.get("consent_ok") !== "1") return { ok: false, message: "Confirma que el despacho tiene el consentimiento de estas personas." };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, message: "Selecciona un archivo .csv" };
  if (file.size > 2_000_000) return { ok: false, message: "El archivo es demasiado grande (máximo 2 MB)." };
  const { parseCsv } = await import("@/lib/csv");
  const { ingestLead } = await import("@/lib/services/leads");
  const { normalizePhone, parseCount, parseMoney } = await import("@/lib/normalize");
  const client = await queryOne<{ name: string }>("SELECT name FROM clients WHERE id = $1", [id]);
  if (!client) return { ok: false, message: "Cliente no encontrado" };
  const rows = parseCsv(await file.text());
  if (!rows.length) return { ok: false, message: "El CSV está vacío o no tiene cabecera." };
  let added = 0, known = 0, invalid = 0;
  for (const r of rows.slice(0, 2000)) {
    const phone = normalizePhone(pick(r, "telefono", "movil", "phone", "tel", "telefono movil"));
    if (!phone) { invalid++; continue; }
    const exists = await queryOne("SELECT 1 FROM leads WHERE client_id = $1 AND phone = $2", [id, phone]);
    if (exists) { known++; continue; }
    await ingestLead({
      client_id: id, source: "reactivacion", silent: true, campaign: "Reactivación",
      full_name: pick(r, "nombre", "nombre completo", "name", "full_name", "cliente"), phone,
      email: pick(r, "email", "correo", "e-mail"), province: pick(r, "provincia", "province", "ciudad"),
      debt_amount: parseMoney(pick(r, "deuda", "importe", "deuda total")), creditors_count: parseCount(pick(r, "acreedores", "num acreedores")),
      consent_text: `Contacto previo de ${client.name}, que lo ha facilitado para volver a llamarle en su nombre.`,
      raw: r,
    });
    added++;
  }
  revalidatePath(`/clientes/${id}`);
  const extra = rows.length > 2000 ? ` Solo se han leído las primeras 2000 filas.` : "";
  return { ok: true, message: `${added} leads añadidos a la cola, ${known} ya estaban, ${invalid} sin teléfono válido.${extra}` };
}
