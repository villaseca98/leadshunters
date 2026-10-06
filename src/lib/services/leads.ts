import "server-only";
import { query, queryOne, tx } from "../db";
import { mapAnswers, matchProvince, normalizeEmail, normalizePhone, parseBool, parseCount, parseEmployment, parseMoney, type LeadFields } from "../normalize";
import { qualifyLead } from "../qualify";
import { MAX_ATTEMPTS, nextRetry, toCallableTime } from "../schedule";
import { emitEvent } from "./events";
import { appUrl } from "@/lib/appUrl";

export type LeadInput = {
  client_id: string;
  source?: string;
  external_id?: string | null;
  campaign?: string | null;
  ad_name?: string | null;
  consent_text?: string | null;
  consent_at?: string | null;
  answers?: Record<string, unknown>; // respuestas libres del formulario
  raw?: unknown;
} & LeadFields;

const SOURCES = ["meta", "google", "web", "manual", "otro"];

type ClientRow = { id: string; name: string; status: string; min_debt: number; min_creditors: number; provinces: string[] };

async function loadClient(id: string) {
  return queryOne<ClientRow>("SELECT id, name, status, min_debt, min_creditors, provinces FROM clients WHERE id = $1", [id]);
}

/** Alta de lead desde Meta/Google/web/manual: normaliza, deduplica, cualifica y avisa a n8n. */
export async function ingestLead(input: LeadInput) {
  const client = await loadClient(input.client_id);
  if (!client) throw new Error("Cliente no encontrado");

  const mapped = input.answers ? mapAnswers(input.answers) : {};
  const f: LeadFields = {
    full_name: (input.full_name ?? mapped.full_name ?? "").toString().trim() || "Sin nombre",
    phone: normalizePhone(input.phone) ?? mapped.phone ?? null,
    email: normalizeEmail(input.email) ?? mapped.email ?? null,
    province: matchProvince(input.province) ?? input.province ?? mapped.province ?? null,
    debt_amount: parseMoney(input.debt_amount) ?? mapped.debt_amount ?? null,
    creditors_count: parseCount(input.creditors_count) ?? mapped.creditors_count ?? null,
    monthly_income: parseMoney(input.monthly_income) ?? mapped.monthly_income ?? null,
    employment_status: parseEmployment(input.employment_status) ?? mapped.employment_status ?? null,
    owns_home: parseBool(input.owns_home) ?? mapped.owns_home ?? null,
    prior_lso: parseBool(input.prior_lso) ?? mapped.prior_lso ?? null,
    criminal_record: parseBool(input.criminal_record) ?? mapped.criminal_record ?? null,
  };
  const q = qualifyLead(f, client);
  const source = SOURCES.includes(input.source ?? "") ? input.source! : "otro";

  // Idempotencia: Meta/Google pueden reenviar el mismo lead
  if (input.external_id) {
    const dup = await queryOne<{ id: string }>(
      "SELECT id FROM leads WHERE client_id = $1 AND source = $2 AND external_id = $3",
      [client.id, source, input.external_id],
    );
    if (dup) return { id: dup.id, duplicate: true, qualification: q };
  }
  // Mismo teléfono en los últimos 30 días para el mismo despacho = duplicado
  const samePhone = f.phone
    ? await queryOne<{ id: string }>(
        "SELECT id FROM leads WHERE client_id = $1 AND phone = $2 AND created_at > now() - interval '30 days' AND status <> 'duplicado'",
        [client.id, f.phone],
      )
    : null;

  const status = samePhone ? "duplicado" : q.status === "no_cualificado" ? "no_cualificado" : "nuevo";

  const row = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO leads(client_id, source, external_id, campaign, ad_name, full_name, phone, email, province, debt_amount,
       creditors_count, monthly_income, employment_status, owns_home, prior_lso, criminal_record, consent_at, consent_text,
       qualification_score, qualification_status, qualification_reasons, status, next_call_at, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING id, created_at`,
    [
      client.id, source, input.external_id ?? null, input.campaign ?? null, input.ad_name ?? null, f.full_name, f.phone,
      f.email, f.province, f.debt_amount, f.creditors_count, f.monthly_income, f.employment_status, f.owns_home,
      f.prior_lso, f.criminal_record, input.consent_at ?? new Date().toISOString(), input.consent_text ?? null,
      q.score, q.status, JSON.stringify(q.reasons), status, toCallableTime(new Date()).toISOString(),
      input.raw ? JSON.stringify(input.raw) : input.answers ? JSON.stringify(input.answers) : null,
    ],
  );

  if (status === "nuevo") {
    await emitEvent("lead.nuevo", {
      lead_id: row!.id, cliente: client.name, client_id: client.id, nombre: f.full_name, telefono: f.phone,
      provincia: f.province, deuda: f.debt_amount, acreedores: f.creditors_count,
      cualificacion: q.status, puntuacion: q.score, origen: source, campana: input.campaign ?? null,
    });
  }
  return { id: row!.id, duplicate: !!samePhone, status, qualification: q };
}

/** Recalcula la cualificación tras editar datos en la llamada. */
export async function requalify(leadId: string) {
  const l = await queryOne<LeadFields & { client_id: string; status: string }>(
    `SELECT client_id, status, full_name, phone, email, province, debt_amount, creditors_count, monthly_income,
            employment_status, owns_home, prior_lso, criminal_record FROM leads WHERE id = $1`,
    [leadId],
  );
  if (!l) return null;
  const client = await loadClient(l.client_id);
  const q = qualifyLead(l, client!);
  await query(
    "UPDATE leads SET qualification_score = $2, qualification_status = $3, qualification_reasons = $4, updated_at = now() WHERE id = $1",
    [leadId, q.score, q.status, JSON.stringify(q.reasons)],
  );
  return q;
}

const LOCK_MINUTES = 10;

/**
 * Siguiente lead a llamar para un telefonista. Prioridad:
 * 1) leads nuevos sin llamar (el más reciente primero: velocidad de contacto),
 * 2) cualificados antes que pendientes/dudosos,
 * 3) rellamadas cuya hora ya ha llegado (la más antigua primero).
 * Bloquea el lead 10 min para que dos telefonistas no llamen al mismo.
 */
export async function claimNextLead(userId: string, clientId?: string | null) {
  return tx(async (c) => {
    // si ya tiene uno bloqueado, se lo devolvemos
    const mine = await c.query(
      `SELECT id FROM leads WHERE locked_by = $1 AND locked_at > now() - interval '${LOCK_MINUTES} minutes'
         AND status IN ('nuevo','no_contesta','volver_a_llamar','en_llamada') LIMIT 1`,
      [userId],
    );
    if (mine.rows[0]) return mine.rows[0].id as string;
    const r = await c.query(
      `SELECT l.id FROM leads l JOIN clients c ON c.id = l.client_id
        WHERE c.status = 'activo'
          AND l.status IN ('nuevo','no_contesta','volver_a_llamar')
          AND l.qualification_status <> 'no_cualificado'
          AND l.next_call_at <= now()
          AND l.phone IS NOT NULL
          AND (l.locked_by IS NULL OR l.locked_at < now() - interval '${LOCK_MINUTES} minutes')
          AND ($1::uuid IS NULL OR l.client_id = $1)
        ORDER BY (l.attempts = 0) DESC,
                 CASE l.qualification_status WHEN 'cualificado' THEN 0 WHEN 'pendiente' THEN 1 ELSE 2 END,
                 CASE WHEN l.attempts = 0 THEN -extract(epoch FROM l.created_at) ELSE extract(epoch FROM l.next_call_at) END
        LIMIT 1
        FOR UPDATE OF l SKIP LOCKED`,
      [clientId ?? null],
    );
    const id = r.rows[0]?.id as string | undefined;
    if (!id) return null;
    await c.query("UPDATE leads SET locked_by = $2, locked_at = now() WHERE id = $1", [id, userId]);
    return id;
  });
}

export async function releaseLead(leadId: string, userId: string) {
  await query("UPDATE leads SET locked_by = NULL, locked_at = NULL WHERE id = $1 AND locked_by = $2", [leadId, userId]);
}

export type CallOutcome =
  | "no_contesta" | "buzon" | "numero_erroneo" | "volver_a_llamar" | "no_cualificado" | "no_interesado" | "cita_agendada";

export type LogCallInput = {
  leadId: string;
  userId: string;
  outcome: CallOutcome;
  notes?: string | null;
  durationS?: number | null;
  callbackAt?: string | null; // para volver_a_llamar
  consultation?: { scheduledAt: string; mode: string; notes?: string | null } | null;
};

/** Registra el resultado de una llamada y mueve el lead en el embudo. */
export async function logCall(i: LogCallInput) {
  const lead = await queryOne<{ id: string; client_id: string; attempts: number; full_name: string; phone: string; email: string | null; first_contact_at: string | null }>(
    "SELECT id, client_id, attempts, full_name, phone, email, first_contact_at FROM leads WHERE id = $1",
    [i.leadId],
  );
  if (!lead) throw new Error("Lead no encontrado");
  const attempts = lead.attempts + 1;
  let status: string;
  let nextCall: Date | null = null;
  const reached = ["volver_a_llamar", "no_cualificado", "no_interesado", "cita_agendada"].includes(i.outcome);

  switch (i.outcome) {
    case "no_contesta":
    case "buzon":
      nextCall = nextRetry(attempts);
      status = nextCall ? "no_contesta" : "descartado";
      break;
    case "numero_erroneo":
    case "no_interesado":
      status = "descartado";
      break;
    case "no_cualificado":
      status = "no_cualificado";
      break;
    case "volver_a_llamar":
      status = "volver_a_llamar";
      nextCall = i.callbackAt ? new Date(i.callbackAt) : nextRetry(1);
      break;
    case "cita_agendada":
      status = "cita_agendada";
      if (!i.consultation?.scheduledAt) throw new Error("Falta la fecha de la cita");
      break;
    default:
      throw new Error("Resultado no válido");
  }

  let consultationId: string | null = null;
  await tx(async (c) => {
    await c.query("INSERT INTO calls(lead_id, user_id, outcome, notes, duration_s) VALUES ($1,$2,$3,$4,$5)", [
      lead.id, i.userId, i.outcome, i.notes ?? null, i.durationS ?? null,
    ]);
    await c.query(
      `UPDATE leads SET status = $2, attempts = $3, last_called_at = now(),
         next_call_at = coalesce($4, next_call_at), first_contact_at = CASE WHEN $5 THEN coalesce(first_contact_at, now()) ELSE first_contact_at END,
         locked_by = NULL, locked_at = NULL,
         notes = CASE WHEN $6::text IS NULL OR $6 = '' THEN notes ELSE concat_ws(E'\\n', notes, $6) END,
         updated_at = now()
       WHERE id = $1`,
      [lead.id, status, attempts, nextCall?.toISOString() ?? null, reached, i.notes ?? null],
    );
    if (i.outcome === "cita_agendada" && i.consultation) {
      const r = await c.query(
        `INSERT INTO consultations(lead_id, client_id, scheduled_at, mode, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [lead.id, lead.client_id, i.consultation.scheduledAt, i.consultation.mode || "telefono", i.consultation.notes ?? null, i.userId],
      );
      consultationId = r.rows[0].id;
    }
  });

  if (consultationId) await emitConsultationEvent("cita.agendada", consultationId);
  return { status, nextCall, consultationId };
}

/** Payload completo de una cita para n8n (email al despacho, SMS al lead...). */
export async function consultationPayload(id: string) {
  return queryOne(
    `SELECT co.id, co.scheduled_at, co.mode, co.status, co.notes, co.confirm_token,
            l.id AS lead_id, l.full_name AS lead_nombre, l.phone AS lead_telefono, l.email AS lead_email, l.province AS lead_provincia,
            l.debt_amount AS deuda, l.creditors_count AS acreedores, l.monthly_income AS ingresos, l.employment_status AS situacion_laboral,
            l.owns_home AS vivienda_propia, l.qualification_reasons AS resumen_cualificacion, l.notes AS notas_llamada,
            c.id AS client_id, c.name AS cliente, c.notify_email AS cliente_email, c.contact_name AS cliente_contacto, c.calendar_url
       FROM consultations co JOIN leads l ON l.id = co.lead_id JOIN clients c ON c.id = co.client_id
      WHERE co.id = $1`,
    [id],
  );
}

export async function emitConsultationEvent(kind: "cita.agendada" | "cita.asistida" | "cita.no_asistio" | "cita.cancelada", id: string) {
  const p = await consultationPayload(id);
  if (!p) return;
  const base = appUrl();
  await emitEvent(kind, { ...p, enlace_confirmar: base ? `${base}/confirmar/${(p as { confirm_token: string }).confirm_token}` : null });
}

/** Marca el resultado de una cita. Solo las asistidas son facturables. */
export async function setConsultationStatus(id: string, status: "asistida" | "no_asistio" | "cancelada" | "agendada", by: "equipo" | "despacho") {
  const row = await queryOne<{ lead_id: string }>(
    `UPDATE consultations SET status = $2, billable = ($2 = 'asistida'), confirmed_by = $3, updated_at = now()
      WHERE id = $1 RETURNING lead_id`,
    [id, status, by],
  );
  if (!row) return null;
  if (status !== "agendada") await emitConsultationEvent(`cita.${status}` as "cita.asistida", id);
  return row;
}

export { MAX_ATTEMPTS };
