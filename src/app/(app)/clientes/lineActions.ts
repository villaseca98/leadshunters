"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parseMoney } from "@/lib/normalize";
import { readField } from "@/lib/lineas";
import { getLine } from "@/lib/services/lines";

function parse(formData: FormData) {
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    name: g("name").slice(0, 120),
    contact_name: g("contact_name") || null,
    contact_phone: g("contact_phone") || null,
    contact_email: g("contact_email") || null,
    status: ["activo", "pausado", "baja"].includes(g("status")) ? g("status") : "activo",
    monthly_fee: parseMoney(g("monthly_fee")) ?? 0,
    price_per_showup: parseMoney(g("price_per_showup")) ?? 0,
    price_per_sale: parseMoney(g("price_per_sale")) ?? 0,
    notes: g("notes") || null,
    started_at: /^\d{4}-\d{2}-\d{2}$/.test(g("started_at")) ? g("started_at") : null,
  };
}

/** Cliente de una línea (luz, placas…): quien te paga por esos leads (Recorta, una comercializadora, un instalador…). */
export async function createLineClient(formData: FormData) {
  await requireAdmin();
  const d = parse(formData);
  const lineId = String(formData.get("line_id") ?? "");
  if (!d.name || !/^[0-9a-f-]{36}$/.test(lineId)) redirect("/clientes?error=Pon%20nombre%20y%20l%C3%ADnea");
  const row = await queryOne<{ id: string }>(
    `INSERT INTO line_clients(line_id, name, contact_name, contact_phone, contact_email, status, monthly_fee, price_per_showup, price_per_sale, notes, started_at)
     SELECT id, $2, $3, $4, $5, $6, $7, $8, $9, $10, coalesce($11::date, current_date) FROM business_lines WHERE id = $1 AND kind <> 'despachos'
     RETURNING id`,
    [lineId, d.name, d.contact_name, d.contact_phone, d.contact_email, d.status, d.monthly_fee, d.price_per_showup, d.price_per_sale, d.notes, d.started_at],
  );
  if (!row) redirect("/clientes?error=L%C3%ADnea%20no%20v%C3%A1lida");
  revalidatePath("/clientes");
  redirect(`/clientes/l/${row.id}?nuevo=1`);
}

export async function updateLineClient(id: string, formData: FormData) {
  await requireAdmin();
  const d = parse(formData);
  if (!d.name) return;
  // campos propios de la línea (comercializadora, kWp, dominio…)
  const cur = await queryOne<{ line_id: string; data: Record<string, string> }>("SELECT line_id, data FROM line_clients WHERE id = $1", [id]);
  if (!cur) return;
  const line = await getLine(cur.line_id);
  const data = { ...cur.data };
  for (const f of line?.client_fields ?? []) {
    const v = readField(f, String(formData.get(`c_${f.key}`) ?? "").trim());
    if (v == null) delete data[f.key];
    else data[f.key] = v;
  }
  await query(
    `UPDATE line_clients SET name = $2, contact_name = $3, contact_phone = $4, contact_email = $5, status = $6,
       monthly_fee = $7, price_per_showup = $8, price_per_sale = $9, notes = $10, started_at = coalesce($11::date, started_at), data = $12
     WHERE id = $1`,
    [id, d.name, d.contact_name, d.contact_phone, d.contact_email, d.status, d.monthly_fee, d.price_per_showup, d.price_per_sale, d.notes, d.started_at, JSON.stringify(data)],
  );
  revalidatePath(`/clientes/l/${id}`);
  revalidatePath("/clientes");
  revalidatePath("/facturacion");
}
