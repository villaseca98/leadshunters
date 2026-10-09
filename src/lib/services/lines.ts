import "server-only";
import { query, queryOne } from "../db";
import { matchLine, scoreLead, statusMap, type Line, type LineStatus, LINE_STATUSES } from "../lineas";
import { matchProvince, normalizeEmail, normalizePhone } from "../normalize";
import { nextRetry } from "../schedule";
import { emitEvent } from "./events";

const LINE_SELECT = `SELECT bl.*, c.name AS company_name, c.slug AS company_slug
  FROM business_lines bl JOIN companies c ON c.id = bl.company_id`;

export async function getLines(opts: { includeInactive?: boolean; includeDespachos?: boolean } = {}): Promise<Line[]> {
  const where = [opts.includeInactive ? "true" : "bl.active AND c.active", opts.includeDespachos === false ? "bl.kind <> 'despachos'" : "true"];
  return query<Line>(`${LINE_SELECT} WHERE ${where.join(" AND ")} ORDER BY c.is_parent, c.position, c.name, bl.position, bl.name`);
}

export async function getLine(idOrSlug: string): Promise<Line | null> {
  const byId = /^[0-9a-f-]{36}$/.test(idOrSlug);
  return queryOne<Line>(`${LINE_SELECT} WHERE ${byId ? "bl.id = $1" : "bl.slug = $1"}`, [idOrSlug]);
}

export async function resolveLine(input: unknown): Promise<Line | null> {
  return matchLine(input, await getLines());
}

export type LineSubmission = {
  line: Line;
  full_name: string;
  phone: string;
  email?: string | null;
  province?: string | null;
  data: Record<string, string>;
  consent: boolean;
  marketing_ok?: boolean;
  channel: string;
  campaign?: string | null;
  utm?: Record<string, string>;
  notes?: string | null;
  raw?: unknown;
  /** reactivación: leads antiguos que ya consintieron; no avisa por WhatsApp y van detrás en la cola */
  reactivation?: boolean;
};

export type LineResult = { ok: true; id: string; duplicate: boolean; priority: "A" | "B" | "C" } | { ok: false; error: string };

/** Alta de un lead en una línea genérica. Mismo teléfono y misma línea en 60 días: actualiza en vez de duplicar. */
export async function submitLineLead(s: LineSubmission): Promise<LineResult> {
  if (s.line.kind === "despachos") return { ok: false, error: "Los leads de despachos entran por el test de deudas." };
  const full_name = s.full_name.trim().slice(0, 120);
  const phone = normalizePhone(s.phone);
  if (!full_name) return { ok: false, error: "Falta el nombre." };
  if (!phone || !/^\+34[6789]\d{8}$/.test(phone)) return { ok: false, error: "Revisa el teléfono: necesitamos un número español." };
  if (!s.consent) return { ok: false, error: "Necesitamos tu permiso para llamarte." };
  const province = matchProvince(s.province) ?? (s.province?.trim() || null);
  const email = normalizeEmail(s.email);
  const channel = s.reactivation ? "reactivacion" : (s.channel || "instagram").slice(0, 40).toLowerCase();
  const campaign = s.campaign?.slice(0, 120) || `${channel}-${s.line.slug}`;

  const prev = await queryOne<{ id: string; data: Record<string, string> }>(
    `SELECT id, data FROM line_leads WHERE phone = $1 AND line_id = $2 AND status <> 'descartado' AND created_at > now() - interval '60 days'
      ORDER BY created_at DESC LIMIT 1`,
    [phone, s.line.id],
  );
  const data = { ...(prev?.data ?? {}), ...s.data };
  const pr = scoreLead(s.line, data);
  if (prev) {
    await query(
      `UPDATE line_leads SET full_name = $2, email = coalesce($3, email), province = coalesce($4, province), data = $5,
         priority = $6, priority_points = $7, priority_reasons = $8, updated_at = now()
       WHERE id = $1`,
      [prev.id, full_name, email, province, JSON.stringify(data), pr.tier, pr.points, JSON.stringify(pr.reasons)],
    );
    return { ok: true, id: prev.id, duplicate: true, priority: pr.tier };
  }
  const row = await queryOne<{ id: string }>(
    `INSERT INTO line_leads(line_id, full_name, phone, email, province, data, priority, priority_points, priority_reasons,
       channel, campaign, utm, consent_text, marketing_ok, notes, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [
      s.line.id, full_name, phone, email, province, JSON.stringify(data), pr.tier, pr.points, JSON.stringify(pr.reasons),
      channel, campaign, JSON.stringify(s.utm ?? {}), s.line.consent_text, !!s.marketing_ok, s.notes || null,
      s.raw ? JSON.stringify(s.raw) : null,
    ],
  );
  if (!s.reactivation) {
    await emitEvent("linea.lead_nuevo", {
      id: row!.id, empresa: s.line.company_name, linea: s.line.slug, linea_nombre: `${s.line.emoji} ${s.line.name}`, nombre: full_name,
      telefono: phone, provincia: province, prioridad: pr.tier, motivos: pr.reasons, canal: channel, campana: campaign,
    });
  }
  return { ok: true, id: row!.id, duplicate: false, priority: pr.tier };
}

/** Resultado de la llamada o cambio de estado. "No contesta" reprograma con la misma cadencia que los despachos. */
export async function setLineStatus(id: string, status: string, extra: { value?: number | null; lost_reason?: string | null; userId?: string } = {}) {
  if (!(LINE_STATUSES as readonly string[]).includes(status)) throw new Error("Estado no válido");
  const cur = await queryOne<{ attempts: number }>("SELECT attempts FROM line_leads WHERE id = $1", [id]);
  if (!cur) return;
  const attempts = cur.attempts + (status === "no_contesta" || status === "contactado" ? 1 : 0);
  const retry = status === "no_contesta" ? nextRetry(attempts) : null;
  // tras el último intento sin respuesta, se descarta solo
  const finalStatus: LineStatus = status === "no_contesta" && !retry ? "descartado" : (status as LineStatus);
  const contacted = ["contactado", "propuesta", "ganado"].includes(finalStatus);
  await query(
    `UPDATE line_leads SET status = $2, attempts = $3,
       next_call_at = coalesce($4, next_call_at),
       last_contact_at = CASE WHEN $2 IN ('no_contesta','contactado','propuesta') THEN now() ELSE last_contact_at END,
       first_contact_at = CASE WHEN $5 THEN coalesce(first_contact_at, now()) ELSE first_contact_at END,
       won_at = CASE WHEN $2 = 'ganado' THEN coalesce(won_at, now()) ELSE NULL END,
       value = CASE WHEN $2 = 'ganado' THEN coalesce($6, value) ELSE value END,
       lost_reason = CASE WHEN $2 = 'descartado' THEN coalesce($7, lost_reason) ELSE NULL END,
       locked_by = NULL, locked_at = NULL, updated_at = now()
     WHERE id = $1`,
    [id, finalStatus, attempts, retry, contacted, extra.value ?? null, finalStatus === "descartado" && status === "no_contesta" ? "No contesta nunca" : extra.lost_reason || null],
  );
}

/** Cola de llamadas de las demás líneas: coge el siguiente (prioridad A primero, luego el más antiguo) y lo bloquea 10 min. */
export async function claimNextLineLead(userId: string, lineId?: string | null): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `UPDATE line_leads SET locked_by = $1, locked_at = now()
      WHERE id = (
        SELECT ll.id FROM line_leads ll JOIN business_lines bl ON bl.id = ll.line_id
         WHERE bl.active AND ll.status IN ('nuevo','no_contesta') AND ll.next_call_at <= now()
           AND (ll.locked_at IS NULL OR ll.locked_at < now() - interval '10 minutes' OR ll.locked_by = $1)
           AND ($2::uuid IS NULL OR ll.line_id = $2)
         ORDER BY (ll.channel = 'reactivacion'), ll.priority, (ll.status = 'nuevo') DESC, ll.created_at
         LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING id`,
    [userId, lineId || null],
  );
  return row?.id ?? null;
}

export async function queueCounts() {
  return query<{ line_id: string; n: number }>(
    `SELECT line_id, count(*)::int n FROM line_leads WHERE status IN ('nuevo','no_contesta') AND next_call_at <= now() GROUP BY line_id`,
  );
}

export { statusMap };
