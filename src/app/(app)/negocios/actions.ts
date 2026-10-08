"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parseOptions, scoreLead, slugify, type LineField } from "@/lib/lineas";
import { parseMoney } from "@/lib/normalize";
import { getLine } from "@/lib/services/lines";

export async function createCompany(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await query("INSERT INTO companies(slug, name, website) VALUES ($1, $2, nullif($3,'')) ON CONFLICT (slug) DO NOTHING", [
    slugify(name), name, String(formData.get("website") ?? "").trim(),
  ]);
  revalidatePath("/negocios");
}

export async function updateCompany(id: string, formData: FormData) {
  await requireAdmin();
  await query("UPDATE companies SET name = coalesce(nullif($2,''), name), website = nullif($3,''), notes = nullif($4,''), active = $5 WHERE id = $1", [
    id, String(formData.get("name") ?? "").trim(), String(formData.get("website") ?? "").trim(), String(formData.get("notes") ?? "").trim(),
    formData.get("active") === "on",
  ]);
  revalidatePath("/negocios");
}

export async function createLine(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company_id") ?? "");
  if (!name || !/^[0-9a-f-]{36}$/.test(company)) redirect("/negocios?error=Pon%20nombre%20y%20empresa");
  let slug = slugify(String(formData.get("slug") ?? "") || name);
  if (await queryOne("SELECT 1 FROM business_lines WHERE slug = $1", [slug])) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  const co = await queryOne<{ name: string }>("SELECT name FROM companies WHERE id = $1", [company]);
  const row = await queryOne<{ id: string }>(
    `INSERT INTO business_lines(company_id, slug, name, emoji, keywords, consent_text)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [company, slug, name, String(formData.get("emoji") ?? "").trim() || "•", [slug],
     `Acepto la política de privacidad y que ${co?.name ?? "la empresa"} o una empresa colaboradora me contacte por teléfono, WhatsApp o email sobre ${name.toLowerCase()}.`],
  );
  redirect(`/negocios/${row!.id}?nueva=1`);
}

/** Guarda la línea: textos, palabras clave, umbrales de prioridad y sus preguntas (con los puntos de cada respuesta). */
export async function updateLine(id: string, formData: FormData) {
  await requireAdmin();
  const line = await getLine(id);
  if (!line || line.kind === "despachos") return;
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const fields: LineField[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const label = g(`label_${i}`);
    if (!label) continue;
    const type = (["select", "bool", "number", "text"].includes(g(`type_${i}`)) ? g(`type_${i}`) : "text") as LineField["type"];
    let key = slugify(g(`key_${i}`) || label).replace(/-/g, "_").slice(0, 30) || `campo_${i}`;
    while (used.has(key)) key += "_2";
    used.add(key);
    const f: LineField = { key, label, type };
    const aliases = g(`aliases_${i}`).split(",").map((s) => s.trim()).filter(Boolean);
    if (aliases.length) f.aliases = aliases;
    if (type === "select") f.options = parseOptions(g(`options_${i}`), line.fields.flatMap((x) => x.options ?? []));
    if (type === "bool") {
      f.points_yes = Number(g(`yes_${i}`)) || 0;
      f.points_no = Number(g(`no_${i}`)) || 0;
    }
    fields.push(f);
  }
  // campos de la ficha de sus clientes
  const clientFields: LineField[] = [];
  const usedC = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const label = g(`cf_label_${i}`);
    if (!label) continue;
    const type = (["select", "number", "text"].includes(g(`cf_type_${i}`)) ? g(`cf_type_${i}`) : "text") as LineField["type"];
    const prev = line.client_fields.find((x) => x.label === label);
    let key = prev?.key ?? (slugify(label).replace(/-/g, "_").slice(0, 30) || `dato_${i}`);
    while (usedC.has(key)) key += "_2";
    usedC.add(key);
    const f: LineField = { key, label, type };
    if (type === "select") f.options = parseOptions(g(`cf_options_${i}`), line.client_fields.flatMap((x) => x.options ?? []));
    clientFields.push(f);
  }
  const keywords = g("keywords").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  await query(
    `UPDATE business_lines SET name = coalesce(nullif($2,''), name), emoji = coalesce(nullif($3,''), emoji), keywords = $4, fields = $5,
       priority_a = $6, priority_b = $7, consent_text = coalesce(nullif($8,''), consent_text), thanks_text = coalesce(nullif($9,''), thanks_text),
       proposal_label = coalesce(nullif($10,''), proposal_label), won_label = coalesce(nullif($11,''), won_label),
       value_label = coalesce(nullif($12,''), value_label), default_value = $13, active = $14, company_id = $15, client_fields = $16
     WHERE id = $1`,
    [
      id, g("name"), g("emoji"), keywords, JSON.stringify(fields), Number(g("priority_a")) || 0, Number(g("priority_b")) || 0,
      g("consent_text"), g("thanks_text"), g("proposal_label"), g("won_label"), g("value_label"), parseMoney(g("default_value")),
      formData.get("active") === "on", g("company_id") || line.company_id, JSON.stringify(clientFields),
    ],
  );
  // recalcula la prioridad de los leads abiertos con las preguntas nuevas
  const updated = (await getLine(id))!;
  const open = await query<{ id: string; data: Record<string, string> }>(
    "SELECT id, data FROM line_leads WHERE line_id = $1 AND status NOT IN ('ganado','descartado')", [id],
  );
  for (const l of open) {
    const pr = scoreLead(updated, l.data);
    await query("UPDATE line_leads SET priority = $2, priority_points = $3, priority_reasons = $4 WHERE id = $1", [l.id, pr.tier, pr.points, JSON.stringify(pr.reasons)]);
  }
  revalidatePath(`/negocios/${id}`);
  revalidatePath("/negocios");
  redirect(`/negocios/${id}?guardado=1`);
}
