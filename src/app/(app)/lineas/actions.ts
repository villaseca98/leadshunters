"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { query, queryOne } from "@/lib/db";
import { extractData, readField, scoreLead } from "@/lib/lineas";
import { matchProvince, normalizeEmail, normalizePhone, parseMoney } from "@/lib/normalize";
import { claimNextLineLead, getLine, setLineStatus, submitLineLead } from "@/lib/services/lines";

export async function changeLineStatus(id: string, fromQueue: boolean, formData: FormData) {
  const user = await requireUser();
  await setLineStatus(id, String(formData.get("status") ?? ""), {
    value: parseMoney(formData.get("value")),
    lost_reason: String(formData.get("lost_reason") ?? "") || null,
    userId: user.id,
  });
  revalidatePath(`/lineas/${id}`);
  revalidatePath("/lineas");
  if (fromQueue) await nextInQueue(user.id, String(formData.get("queue_line") ?? ""));
}

/** Coge el siguiente lead de la cola (de una línea, por su slug, o de todas) y abre su ficha. */
async function nextInQueue(userId: string, slug: string) {
  const line = slug ? await getLine(slug) : null;
  const id = await claimNextLineLead(userId, line?.id ?? null);
  const q = line ? `linea=${line.slug}` : "";
  redirect(id ? `/lineas/${id}?cola=${line?.slug ?? "todas"}` : `/lineas/cola?vacia=1${q ? `&${q}` : ""}`);
}

export async function takeNextLineLead(formData: FormData) {
  const user = await requireUser();
  await nextInQueue(user.id, String(formData.get("linea") ?? ""));
}

/** Datos confirmados al hablar con la persona: recalcula la prioridad con las preguntas de su línea. */
export async function updateLineLead(id: string, formData: FormData) {
  await requireUser();
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const cur = await query<{ line_id: string; data: Record<string, string> }>("SELECT line_id, data FROM line_leads WHERE id = $1", [id]);
  if (!cur[0]) return;
  const line = await getLine(g("line_id") || cur[0].line_id);
  if (!line || line.kind === "despachos") return;
  const data = { ...cur[0].data };
  for (const f of line.fields) {
    const v = readField(f, g(`f_${f.key}`));
    if (v == null) delete data[f.key];
    else data[f.key] = v;
  }
  const pr = scoreLead(line, data);
  // el cliente tiene que ser de la misma línea; si se cambia de línea sin elegir, se pone el de serie
  const clientId = /^[0-9a-f-]{36}$/.test(g("client_id")) ? g("client_id") : null;
  await query(
    `UPDATE line_leads SET line_id = $2, full_name = coalesce(nullif($3,''), full_name), phone = coalesce($4, phone), email = $5,
       province = $6, data = $7, notes = nullif($8,''), value = $9, priority = $10, priority_points = $11, priority_reasons = $12,
       client_id = CASE WHEN EXISTS (SELECT 1 FROM line_clients WHERE id = $13 AND line_id = $2) THEN $13::uuid
                       WHEN line_id = $2 THEN (CASE WHEN $14 THEN NULL ELSE client_id END)
                       ELSE NULL END,
       updated_at = now()
     WHERE id = $1`,
    [
      id, line.id, g("full_name"), normalizePhone(g("phone")), normalizeEmail(g("email")), matchProvince(g("province")) ?? (g("province") || null),
      JSON.stringify(data), g("notes"), parseMoney(g("value")), pr.tier, pr.points, JSON.stringify(pr.reasons),
      clientId, formData.has("client_id"),
    ],
  );
  revalidatePath(`/lineas/${id}`);
}

/** El lead se convierte en cliente de su línea: se crea su ficha (con sus datos) y se marca como cerrado. */
export async function convertLineLead(id: string) {
  const user = await requireUser();
  const l = await queryOne<{ line_id: string; full_name: string; phone: string; email: string | null; client_id: string | null; status: string; notes: string | null }>(
    "SELECT line_id, full_name, phone, email, client_id, status, notes FROM line_leads WHERE id = $1",
    [id],
  );
  if (!l) return;
  let clientId = l.client_id;
  if (!clientId) {
    const c = await queryOne<{ id: string }>(
      `INSERT INTO line_clients(line_id, name, contact_name, contact_phone, contact_email, notes, lead_id)
       VALUES ($1, $2, $2, $3, $4, $5, $6) RETURNING id`,
      [l.line_id, l.full_name, l.phone, l.email, l.notes, id],
    );
    clientId = c!.id;
    await query("UPDATE line_leads SET client_id = $2 WHERE id = $1", [id, clientId]);
  }
  if (l.status !== "ganado") await setLineStatus(id, "ganado", { userId: user.id });
  revalidatePath(`/lineas/${id}`);
  revalidatePath("/clientes");
  redirect(`/clientes/l/${clientId}?nuevo=1`);
}

/** Se presentó a la cita o visita (show-up): cuenta para lo que le facturas al cliente ese mes. */
export async function toggleShowup(id: string) {
  await requireUser();
  const r = await queryOne<{ client_id: string | null }>(
    "UPDATE line_leads SET showup_at = CASE WHEN showup_at IS NULL THEN now() ELSE NULL END, updated_at = now() WHERE id = $1 RETURNING client_id",
    [id],
  );
  revalidatePath(`/lineas/${id}`);
  if (r?.client_id) revalidatePath(`/clientes/l/${r.client_id}`);
}

export async function createLineLead(formData: FormData) {
  await requireUser();
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const line = await getLine(g("line_id"));
  if (!line) redirect("/lineas/nuevo?error=Elige%20una%20l%C3%ADnea");
  const body: Record<string, unknown> = {};
  for (const f of line.fields) body[f.key] = g(`f_${f.key}`);
  const r = await submitLineLead({
    line,
    full_name: g("full_name"),
    phone: g("phone"),
    email: g("email") || null,
    province: g("province") || null,
    data: extractData(line.fields, body),
    consent: formData.get("consent") === "on",
    channel: g("channel") || "manual",
    campaign: g("campaign") || null,
    notes: g("notes") || null,
  });
  if (!r.ok) redirect(`/lineas/nuevo?linea=${line.slug}&error=${encodeURIComponent(r.error)}`);
  redirect(`/lineas/${r.id}`);
}

/** Reactivación: CSV de contactos antiguos que ya dieron su permiso. Columnas libres: nombre, telefono, provincia, email y las preguntas de la línea. */
export async function importLineCsv(formData: FormData) {
  await requireAdmin();
  const line = await getLine(String(formData.get("line_id") ?? ""));
  const file = formData.get("file");
  if (!line || line.kind === "despachos" || !(file instanceof File) || file.size === 0) redirect("/lineas/importar?error=Falta%20la%20l%C3%ADnea%20o%20el%20archivo");
  if (formData.get("consent") !== "on") redirect("/lineas/importar?error=Confirma%20que%20estas%20personas%20dieron%20su%20permiso");
  const rows = parseCsv(await file.text()).slice(0, 5000);
  let ok = 0, dup = 0, bad = 0;
  for (const r of rows) {
    const k = Object.fromEntries(Object.entries(r).map(([key, v]) => [key.toLowerCase().trim(), v]));
    const res = await submitLineLead({
      line,
      full_name: k.nombre ?? k.name ?? k.full_name ?? "",
      phone: k.telefono ?? k["teléfono"] ?? k.phone ?? k.movil ?? "",
      email: k.email ?? k.correo ?? null,
      province: k.provincia ?? k.province ?? null,
      data: extractData(line.fields, k),
      consent: true,
      channel: "reactivacion",
      campaign: String(formData.get("campaign") ?? "") || "reactivacion",
      reactivation: true,
    });
    if (!res.ok) bad++;
    else if (res.duplicate) dup++;
    else ok++;
  }
  redirect(`/lineas?linea=${line.slug}&importados=${ok}&repetidos=${dup}&errores=${bad}`);
}

/** Derecho de supresión (RGPD): borra el lead del todo. */
export async function eraseLineLead(id: string) {
  await requireAdmin();
  await query("DELETE FROM line_leads WHERE id = $1", [id]);
  redirect("/lineas");
}
