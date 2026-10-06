"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { fromApifyItem, upsertProspect, analyzeHtml, applyEnrichment } from "@/lib/services/prospects";
import { fromLocalInput } from "@/lib/format";
import { emitEvent } from "@/lib/services/events";
import { PROSPECT_STATUS } from "@/lib/labels";

export async function updateProspectStatus(id: string, formData: FormData) {
  const user = await requireUser();
  const status = String(formData.get("status"));
  if (!PROSPECT_STATUS[status]) throw new Error("Estado no válido");
  const next = String(formData.get("next_action_at") ?? "");
  await query("UPDATE prospects SET status = $2, next_action_at = $3, updated_at = now() WHERE id = $1", [
    id, status, next ? fromLocalInput(next).toISOString() : null,
  ]);
  await query("INSERT INTO prospect_activities(prospect_id, user_id, kind, outcome) VALUES ($1,$2,'estado',$3)", [id, user.id, status]);
  revalidatePath(`/prospeccion/${id}`);
}

const OUTCOME_TO_STATUS: Record<string, string> = {
  no_contesta: "no_contesta",
  hablar_con_decisor: "contactado",
  no_interesa: "descartado",
  interesado: "interesado",
  reunion: "reunion",
  propuesta: "propuesta",
  llamar_mas_tarde: "a_llamar",
};

/** Registra una llamada/acción comercial con un despacho y avanza su estado. */
export async function logProspectActivity(id: string, formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "llamada");
  const outcome = String(formData.get("outcome") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const next = String(formData.get("next_action_at") ?? "");
  await query("INSERT INTO prospect_activities(prospect_id, user_id, kind, outcome, notes) VALUES ($1,$2,$3,$4,$5)", [
    id, user.id, kind, outcome || null, notes,
  ]);
  const status = OUTCOME_TO_STATUS[outcome];
  // si no se indica, programamos el siguiente toque según el resultado
  const DEFAULT_HOURS: Record<string, number> = {
    no_contesta: 24, llamar_mas_tarde: 3, hablar_con_decisor: 72, interesado: 48, reunion: 168, propuesta: 72,
  };
  let nextAt: Date | null = next ? fromLocalInput(next) : null;
  if (!nextAt && DEFAULT_HOURS[outcome]) nextAt = new Date(Date.now() + DEFAULT_HOURS[outcome] * 3600_000);
  if (status || nextAt) {
    await query(
      "UPDATE prospects SET status = coalesce($2, status), next_action_at = $3, owner_id = coalesce(owner_id, $4), updated_at = now() WHERE id = $1",
      [id, status ?? null, nextAt?.toISOString() ?? null, user.id],
    );
  }
  revalidatePath(`/prospeccion/${id}`);
  if (formData.get("go_next")) redirect("/prospeccion/llamar");
}

export async function saveProspectNotes(id: string, formData: FormData) {
  await requireUser();
  await query("UPDATE prospects SET notes = $2, updated_at = now() WHERE id = $1", [id, String(formData.get("notes") ?? "")]);
  revalidatePath(`/prospeccion/${id}`);
}

/** Descarga la web del despacho y la analiza (redes, formulario, WhatsApp, píxel, si habla de LSO). */
export async function analyzeWebsite(id: string) {
  await requireUser();
  const p = await queryOne<{ website: string | null }>("SELECT website FROM prospects WHERE id = $1", [id]);
  if (!p?.website) return;
  try {
    const res = await fetch(p.website, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; LeadsHuntersBot/1.0)" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    const html = await res.text();
    await applyEnrichment(id, analyzeHtml(html));
  } catch (e) {
    console.warn("No se pudo analizar la web", p.website, (e as Error).message);
    await query("UPDATE prospects SET enriched_at = now() WHERE id = $1", [id]);
  }
  revalidatePath(`/prospeccion/${id}`);
}

export async function setMetaAds(id: string, formData: FormData) {
  await requireUser();
  const v = String(formData.get("meta_ads"));
  await applyEnrichment(id, {
    meta_ads_active: v === "si" || v === "si_lso",
    meta_ads_lso: v === "si_lso",
    meta_ads_count: Number(formData.get("meta_ads_count") || 0) || null,
  });
  revalidatePath(`/prospeccion/${id}`);
}

/** Convierte un despacho en cliente (crea la ficha con los datos que ya tenemos). */
export async function convertToClient(id: string) {
  await requireUser();
  const p = await queryOne<{ name: string; phone: string | null; email: string | null; city: string | null; province: string | null }>(
    "SELECT name, phone, email, city, province FROM prospects WHERE id = $1",
    [id],
  );
  if (!p) return;
  const existing = await queryOne<{ id: string }>("SELECT id FROM clients WHERE prospect_id = $1", [id]);
  const clientId =
    existing?.id ??
    (await queryOne<{ id: string }>(
      `INSERT INTO clients(prospect_id, name, contact_phone, contact_email, notify_email, city, provinces)
       VALUES ($1,$2,$3,$4,$4,$5,$6) RETURNING id`,
      [id, p.name, p.phone, p.email, p.city, p.province ? [p.province] : []],
    ))!.id;
  await query("UPDATE prospects SET status = 'cliente', updated_at = now() WHERE id = $1", [id]);
  await emitEvent("prospecto.cliente", { prospect_id: id, client_id: clientId, nombre: p.name });
  redirect(`/clientes/${clientId}?nuevo=1`);
}

export async function createProspect(formData: FormData) {
  await requireUser();
  const get = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const item = fromApifyItem({
    title: get("name"), phone: get("phone"), website: get("website"), city: get("city"),
    email: get("email"), categoryName: get("category") ?? "Abogado",
  });
  if (!item) return;
  item.source = "manual";
  const { id } = await upsertProspect(item);
  redirect(`/prospeccion/${id}`);
}

/** Importa un JSON exportado de Apify o un CSV (cabeceras en la primera fila). */
export async function importProspects(_: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  await requireUser();
  const file = formData.get("file") as File | null;
  const searchTerm = String(formData.get("search_term") ?? "").trim() || null;
  if (!file || file.size === 0) return { ok: false, message: "Selecciona un archivo .json o .csv" };
  const text = await file.text();
  let items: Record<string, unknown>[] = [];
  try {
    if (file.name.endsWith(".json") || text.trim().startsWith("[") || text.trim().startsWith("{")) {
      const parsed = JSON.parse(text);
      items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [parsed];
    } else {
      items = parseCsv(text);
    }
  } catch (e) {
    return { ok: false, message: `No se pudo leer el archivo: ${(e as Error).message}` };
  }
  let created = 0, updated = 0, skipped = 0;
  for (const it of items) {
    const p = fromApifyItem(it, searchTerm);
    if (!p) { skipped++; continue; }
    p.source = file.name.endsWith(".csv") ? "csv" : "google_maps";
    const r = await upsertProspect(p);
    if (r.created) created++; else updated++;
  }
  revalidatePath("/prospeccion");
  return { ok: true, message: `${created} despachos nuevos, ${updated} actualizados, ${skipped} descartados (cerrados o sin nombre).` };
}

function parseCsv(text: string): Record<string, unknown>[] {
  const sep = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  // admite cabeceras de Apify (title, phone, website...) y en español (nombre, telefono, web...)
  const alias: Record<string, string> = {
    nombre: "title", empresa: "title", name: "title", telefono: "phone", "teléfono": "phone", web: "website",
    ciudad: "city", categoria: "categoryName", "categoría": "categoryName", valoracion: "totalScore", "valoración": "totalScore",
    resenas: "reviewsCount", "reseñas": "reviewsCount", direccion: "address", "dirección": "address", provincia: "state",
    "instagrams/0": "instagram", "facebooks/0": "facebook", "emails/0": "email", "linkedins/0": "linkedin",
  };
  const keys = head.map((h) => alias[h.trim().toLowerCase()] ?? h.trim());
  return body.map((r) => {
    const o: Record<string, unknown> = {};
    keys.forEach((k, i) => {
      const v = r[i]?.trim();
      if (!v) return;
      o[k] = ["totalScore", "reviewsCount"].includes(k) ? Number(v.replace(",", ".")) : v;
    });
    return o;
  });
}
