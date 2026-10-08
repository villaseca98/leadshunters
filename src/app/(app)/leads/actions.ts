"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { fromLocalInput } from "@/lib/format";
import { claimNextLead, ingestLead, logCall, releaseLead, requalify, type CallOutcome } from "@/lib/services/leads";
import { parseRoof, parseShare, parseTariff } from "@/lib/energy";
import { matchProvince, normalizeEmail, normalizePhone, parseBool, parseCount, parseEmployment, parseMoney } from "@/lib/normalize";

export async function takeNext(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("client_id") ?? "") || null;
  const id = await claimNextLead(user.id, clientId);
  redirect(id ? `/cola/${id}${clientId ? `?cliente=${clientId}` : ""}` : "/cola?vacia=1");
}

export async function release(leadId: string) {
  const user = await requireUser();
  await releaseLead(leadId, user.id);
  redirect("/cola");
}

/** Guarda los datos que el telefonista confirma en la llamada y recalcula la cualificación. */
export async function updateLeadData(leadId: string, formData: FormData) {
  await requireUser();
  const g = (k: string) => {
    const v = formData.get(k);
    return v === null ? undefined : String(v).trim();
  };
  const bool = (k: string) => (g(k) === "" || g(k) === undefined ? null : parseBool(g(k)));
  // Luz y placas: la pantalla de llamada manda otros campos (factura, tarifa, cubierta…)
  if (formData.get("monthly_bill") !== null) {
    const n = (k: string) => { const v = parseMoney(g(k)); return v == null ? null : v; };
    await query(
      `UPDATE leads SET full_name = coalesce(nullif($2,''), full_name), phone = coalesce($3, phone), email = $4, province = $5,
         business_type = $6, monthly_bill = $7, tariff = $8, contracted_power_kw = $9, current_supplier = $10, roof = $11,
         daytime_share = $12, postal_code = coalesce($13, postal_code), updated_at = now()
       WHERE id = $1`,
      [
        leadId, g("full_name") ?? "", normalizePhone(g("phone")), normalizeEmail(g("email")), matchProvince(g("province")) ?? (g("province") || null),
        g("business_type") || null, n("monthly_bill"), parseTariff(g("tariff")), n("contracted_power_kw"), g("current_supplier") || null,
        parseRoof(g("roof")), parseShare(g("daytime_share")), (g("postal_code")?.match(/\d{5}/) ?? [null])[0],
      ],
    );
    await requalify(leadId);
    revalidatePath(`/cola/${leadId}`);
    revalidatePath(`/leads/${leadId}`);
    return;
  }
  await query(
    `UPDATE leads SET full_name = coalesce(nullif($2,''), full_name), phone = coalesce($3, phone), email = $4, province = $5,
       debt_amount = $6, creditors_count = $7, monthly_income = $8, employment_status = $9, owns_home = $10,
       prior_lso = $11, criminal_record = $12, updated_at = now()
     WHERE id = $1`,
    [
      leadId, g("full_name") ?? "", normalizePhone(g("phone")), normalizeEmail(g("email")), matchProvince(g("province")) ?? (g("province") || null),
      parseMoney(g("debt_amount")), parseCount(g("creditors_count")), parseMoney(g("monthly_income")),
      g("employment_status") ? parseEmployment(g("employment_status")) : null, bool("owns_home"), bool("prior_lso"), bool("criminal_record"),
    ],
  );
  await requalify(leadId);
  revalidatePath(`/cola/${leadId}`);
  revalidatePath(`/leads/${leadId}`);
}

/** Resultado de la llamada. Si viene de la cola, salta directamente al siguiente lead. */
export async function logCallAction(leadId: string, formData: FormData) {
  const user = await requireUser();
  const outcome = String(formData.get("outcome")) as CallOutcome;
  const scheduled = String(formData.get("scheduled_at") ?? "");
  const callback = String(formData.get("callback_at") ?? "");
  const started = Number(formData.get("started_at") ?? 0);
  // primero guardamos los datos de cualificación del mismo formulario
  if (formData.get("full_name") !== null) await updateLeadData(leadId, formData);
  await logCall({
    leadId,
    userId: user.id,
    outcome,
    notes: String(formData.get("notes") ?? "").trim() || null,
    durationS: started ? Math.round((Date.now() - started) / 1000) : null,
    callbackAt: callback ? fromLocalInput(callback).toISOString() : null,
    consultation:
      outcome === "cita_agendada"
        ? { scheduledAt: fromLocalInput(scheduled).toISOString(), mode: String(formData.get("mode") ?? "telefono"), notes: String(formData.get("consultation_notes") ?? "") || null }
        : null,
    deal: outcome === "oportunidad" ? { notes: String(formData.get("deal_notes") ?? "").trim() || null } : null,
  });
  revalidatePath("/cola");
  revalidatePath("/oportunidades");
  if (formData.get("from") === "cola") {
    const clientId = String(formData.get("client_filter") ?? "") || null;
    const next = await claimNextLead(user.id, clientId);
    redirect(next ? `/cola/${next}${clientId ? `?cliente=${clientId}` : ""}` : "/cola?vacia=1");
  }
  redirect(`/leads/${leadId}`);
}

export async function createLead(formData: FormData) {
  await requireUser();
  const g = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const r = await ingestLead({
    client_id: g("client_id")!,
    source: g("source") ?? "manual",
    full_name: g("full_name"),
    phone: g("phone"),
    email: g("email"),
    province: g("province"),
    debt_amount: parseMoney(g("debt_amount")),
    creditors_count: parseCount(g("creditors_count")),
    monthly_income: parseMoney(g("monthly_income")),
    employment_status: g("employment_status"),
    consent_text: "Alta manual por el equipo (el interesado contactó directamente)",
  });
  redirect(`/leads/${r.id}`);
}

/** RGPD: derecho de supresión. Anonimiza el lead y guarda constancia sin datos personales. */
export async function eraseLead(leadId: string) {
  const user = await requireAdmin();
  await query(
    `UPDATE leads SET full_name = 'Suprimido (RGPD)', phone = NULL, email = NULL, notes = NULL, raw = NULL, consent_text = NULL,
       summary = NULL, postal_code = NULL,
       status = CASE WHEN status IN ('cita_agendada','oportunidad') THEN status ELSE 'descartado' END, updated_at = now()
     WHERE id = $1`,
    [leadId],
  );
  await query("UPDATE calls SET notes = NULL WHERE lead_id = $1", [leadId]);
  await query("UPDATE deals SET notes = NULL WHERE lead_id = $1", [leadId]);
  await query("UPDATE deal_events SET note = NULL WHERE deal_id IN (SELECT id FROM deals WHERE lead_id = $1)", [leadId]);
  await query("INSERT INTO gdpr_log(action, subject, user_id) VALUES ('supresion_lead', $1, $2)", [leadId, user.id]);
  revalidatePath(`/leads/${leadId}`);
}
