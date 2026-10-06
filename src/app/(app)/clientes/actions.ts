"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { matchProvince } from "@/lib/normalize";

function parse(formData: FormData) {
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const num = (k: string, d: number | null) => (g(k) === "" ? d : Number(g(k).replace(",", ".")));
  const list = (k: string) => g(k).split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);
  return {
    name: g("name"),
    contact_name: g("contact_name") || null,
    contact_phone: g("contact_phone") || null,
    contact_email: g("contact_email") || null,
    notify_email: g("notify_email") || null,
    city: g("city") || null,
    provinces: list("provinces").map((p) => matchProvince(p) ?? p),
    status: ["activo", "pausado", "baja"].includes(g("status")) ? g("status") : "activo",
    monthly_fee: num("monthly_fee", 500),
    price_per_consultation: num("price_per_consultation", 40),
    max_billable_per_month: num("max_billable_per_month", null),
    min_debt: num("min_debt", 8000),
    min_creditors: num("min_creditors", 2),
    calendar_url: g("calendar_url") || null,
    meta_form_ids: list("meta_form_ids"),
    google_form_ids: list("google_form_ids"),
    started_at: g("started_at") || new Date().toISOString().slice(0, 10),
    notes: g("notes") || null,
  };
}

const COLS = [
  "name", "contact_name", "contact_phone", "contact_email", "notify_email", "city", "provinces", "status", "monthly_fee",
  "price_per_consultation", "max_billable_per_month", "min_debt", "min_creditors", "calendar_url", "meta_form_ids",
  "google_form_ids", "started_at", "notes",
] as const;

export async function createClient(formData: FormData) {
  await requireAdmin();
  const d = parse(formData);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO clients(${COLS.join(",")}) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`,
    COLS.map((c) => d[c]),
  );
  redirect(`/clientes/${row!.id}`);
}

export async function updateClient(id: string, formData: FormData) {
  await requireAdmin();
  const d = parse(formData);
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
