import "server-only";
import type { PoolClient } from "pg";
import { query, queryOne, tx } from "../db";
import { DEAL_STAGES, FIRST_STAGE, isEnergy, nextStages } from "../energy";
import { emitEvent } from "./events";
import { appUrl } from "@/lib/appUrl";

// Oportunidades de luz y placas: lo que pasa con el lead después de la llamada.
// Luz: el equipo prepara la oferta y la lleva hasta el contrato activado (se cobra la comisión).
// Placas: el lead se pasa al instalador, que lo acepta o rechaza desde su enlace (/socio/<token>)
// y va marcando visita, presupuesto y obra firmada.

export type DealRow = {
  id: string;
  lead_id: string;
  client_id: string;
  vertical: "luz" | "placas";
  stage: string;
  offer_supplier: string | null;
  offer_annual_saving: number | null;
  visit_at: string | null;
  budget_amount: number | null;
  kwp: number | null;
  signed_amount: number | null;
  accepted_at: string | null;
  accepted_by: string | null;
  rejected_reason: string | null;
  signed_at: string | null;
  activated_at: string | null;
  lost_reason: string | null;
  partner_token: string;
  partner_notified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DealListRow = DealRow & {
  full_name: string;
  phone: string | null;
  province: string | null;
  business_type: string | null;
  monthly_bill: number | null;
  tariff: string | null;
  cliente: string;
  accept_hours: number;
};

/** Crea la oportunidad dentro de la transacción de la llamada. */
export async function createDealTx(
  c: PoolClient,
  i: { leadId: string; clientId: string; userId: string | null; notes?: string | null; visitAt?: string | null },
) {
  const cl = await c.query<{ vertical: string }>("SELECT vertical FROM clients WHERE id = $1", [i.clientId]);
  const vertical = cl.rows[0]?.vertical;
  if (!isEnergy(vertical)) throw new Error("Las oportunidades son solo para clientes de luz o placas");
  const stage = FIRST_STAGE[vertical];
  const r = await c.query<{ id: string }>(
    `INSERT INTO deals(lead_id, client_id, vertical, stage, notes, visit_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (lead_id, client_id) DO UPDATE SET stage = CASE WHEN deals.stage IN ('perdido','rechazado') THEN EXCLUDED.stage ELSE deals.stage END,
       notes = concat_ws(E'\\n', deals.notes, EXCLUDED.notes), updated_at = now()
     RETURNING id`,
    [i.leadId, i.clientId, vertical, stage, i.notes || null, i.visitAt || null, i.userId],
  );
  const id = r.rows[0].id;
  await c.query("INSERT INTO deal_events(deal_id, stage, by_who, note) VALUES ($1,$2,'equipo',$3)", [id, stage, i.notes || null]);
  return id;
}

const SELECT_LIST = `SELECT d.*, l.full_name, l.phone, l.province, l.business_type, l.monthly_bill, l.tariff, c.name AS cliente, c.accept_hours
  FROM deals d JOIN leads l ON l.id = d.lead_id JOIN clients c ON c.id = d.client_id`;

export async function listDeals(f: { vertical?: string | null; stage?: string | null; clientId?: string | null } = {}) {
  await autoAcceptExpired();
  return query<DealListRow>(
    `${SELECT_LIST}
      WHERE ($1::text IS NULL OR d.vertical = $1) AND ($2::text IS NULL OR d.stage = $2) AND ($3::uuid IS NULL OR d.client_id = $3)
      ORDER BY CASE WHEN d.stage IN ('perdido','rechazado','activado') THEN 1 ELSE 0 END, d.updated_at DESC
      LIMIT 300`,
    [f.vertical || null, f.stage || null, f.clientId || null],
  );
}

export async function dealForLead(leadId: string) {
  return queryOne<DealListRow>(`${SELECT_LIST} WHERE d.lead_id = $1 ORDER BY d.created_at DESC LIMIT 1`, [leadId]);
}

export async function dealByToken(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  await autoAcceptExpired();
  return queryOne<DealListRow & { email: string | null; postal_code: string | null; roof: string | null; daytime_share: number | null;
    contracted_power_kw: number | null; current_supplier: string | null; summary: string | null; estimated_saving: number | null }>(
    `SELECT d.*, l.full_name, l.phone, l.email, l.province, l.postal_code, l.business_type, l.monthly_bill, l.tariff, l.roof,
            l.daytime_share, l.contracted_power_kw, l.current_supplier, l.summary, l.estimated_saving, c.name AS cliente, c.accept_hours
       FROM deals d JOIN leads l ON l.id = d.lead_id JOIN clients c ON c.id = d.client_id WHERE d.partner_token = $1`,
    [token],
  );
}

export async function dealHistory(dealId: string) {
  return query<{ stage: string; by_who: string; note: string | null; created_at: string }>(
    "SELECT stage, by_who, note, created_at FROM deal_events WHERE deal_id = $1 ORDER BY created_at",
    [dealId],
  );
}

export type StageExtra = {
  offer_supplier?: string | null;
  offer_annual_saving?: number | null;
  visit_at?: string | null;
  budget_amount?: number | null;
  kwp?: number | null;
  signed_amount?: number | null;
  note?: string | null;
};

/**
 * Mueve la oportunidad de etapa. El socio (instalador/comercializadora) solo puede avanzar por el flujo normal;
 * el equipo puede corregir a cualquier etapa de su línea.
 */
export async function setDealStage(id: string, stage: string, by: "equipo" | "socio" | "automatico", extra: StageExtra = {}) {
  const d = await queryOne<DealRow>("SELECT * FROM deals WHERE id = $1", [id]);
  if (!d) throw new Error("Oportunidad no encontrada");
  if (!DEAL_STAGES[d.vertical].includes(stage)) throw new Error("Etapa no válida para esta línea");
  if (by !== "equipo" && stage !== d.stage && !nextStages(d.vertical, d.stage).includes(stage)) throw new Error("Ese paso no está permitido desde la etapa actual");
  if (stage === "firmado" && d.vertical === "placas" && !(extra.signed_amount ?? d.signed_amount))
    throw new Error("Indica el importe de la obra firmada");

  const accepting = d.vertical === "placas" && ["aceptado", "visita", "presupuesto", "firmado"].includes(stage) && !d.accepted_at;
  await tx(async (c) => {
    await c.query(
      `UPDATE deals SET stage = $2,
         offer_supplier = coalesce($3, offer_supplier), offer_annual_saving = coalesce($4, offer_annual_saving),
         visit_at = coalesce($5, visit_at), budget_amount = coalesce($6, budget_amount), kwp = coalesce($7, kwp),
         signed_amount = coalesce($8, signed_amount),
         accepted_at = CASE WHEN $9 THEN now() WHEN $2 = 'rechazado' THEN NULL ELSE accepted_at END,
         accepted_by = CASE WHEN $9 THEN $10 WHEN $2 = 'rechazado' THEN NULL ELSE accepted_by END,
         rejected_reason = CASE WHEN $2 = 'rechazado' THEN $11 ELSE rejected_reason END,
         lost_reason = CASE WHEN $2 = 'perdido' THEN $11 ELSE lost_reason END,
         signed_at = CASE WHEN $2 IN ('firmado','activado') THEN coalesce(signed_at, now()) ELSE signed_at END,
         activated_at = CASE WHEN $2 = 'activado' THEN coalesce(activated_at, now()) WHEN $2 <> 'activado' AND $12 THEN NULL ELSE activated_at END,
         updated_at = now()
       WHERE id = $1`,
      [id, stage, extra.offer_supplier || null, extra.offer_annual_saving ?? null, extra.visit_at || null, extra.budget_amount ?? null,
       extra.kwp ?? null, extra.signed_amount ?? null, accepting, by, extra.note || null, by === "equipo"],
    );
    await c.query("INSERT INTO deal_events(deal_id, stage, by_who, note) VALUES ($1,$2,$3,$4)", [id, stage, by, extra.note || null]);
  });
  if (stage !== d.stage) await emitDealEvent("oportunidad.etapa", id);
  return { from: d.stage, to: stage };
}

/** Placas: si el instalador no responde en su plazo, el lead se da por aceptado (y se cobra). */
export async function autoAcceptExpired() {
  const rows = await query<{ id: string }>(
    `UPDATE deals d SET stage = 'aceptado', accepted_at = now(), accepted_by = 'automatico', updated_at = now()
       FROM clients c
      WHERE c.id = d.client_id AND d.vertical = 'placas' AND d.stage = 'enviado'
        AND d.created_at < now() - make_interval(hours => c.accept_hours)
      RETURNING d.id`,
  );
  for (const r of rows) {
    await query("INSERT INTO deal_events(deal_id, stage, by_who, note) VALUES ($1,'aceptado','automatico','Sin respuesta en el plazo: aceptado')", [r.id]);
  }
  return rows.length;
}

/** Datos para n8n: email al instalador/comercializadora con el enlace, aviso al equipo… */
export async function dealPayload(id: string) {
  const p = await queryOne<Record<string, unknown> & { partner_token: string }>(
    `SELECT d.id, d.vertical AS linea, d.stage AS etapa, d.partner_token, d.offer_supplier AS oferta_comercializadora,
            d.offer_annual_saving AS oferta_ahorro_anual, d.visit_at AS visita, d.budget_amount AS presupuesto, d.kwp,
            d.signed_amount AS importe_firmado, d.notes AS notas,
            l.id AS lead_id, l.full_name AS lead_nombre, l.phone AS lead_telefono, l.email AS lead_email, l.province AS lead_provincia,
            l.postal_code AS lead_cp, l.business_type AS negocio, l.monthly_bill AS factura_mes, l.tariff AS tarifa,
            l.contracted_power_kw AS potencia_kw, l.current_supplier AS comercializadora_actual, l.roof AS cubierta,
            l.daytime_share AS consumo_de_dia_pct, l.summary AS resumen_web, l.qualification_reasons AS resumen_cualificacion,
            c.id AS client_id, c.name AS cliente, c.brand AS marca, c.notify_email AS cliente_email, c.contact_name AS cliente_contacto,
            c.accept_hours AS horas_para_rechazar
       FROM deals d JOIN leads l ON l.id = d.lead_id JOIN clients c ON c.id = d.client_id WHERE d.id = $1`,
    [id],
  );
  if (!p) return null;
  const base = appUrl();
  return { ...p, enlace_socio: base ? `${base}/socio/${p.partner_token}` : null };
}

export async function emitDealEvent(kind: "oportunidad.nueva" | "oportunidad.etapa", id: string) {
  const p = await dealPayload(id);
  if (!p) return;
  await emitEvent(kind, p);
  if (kind === "oportunidad.nueva") await query("UPDATE deals SET partner_notified_at = now() WHERE id = $1", [id]);
}
