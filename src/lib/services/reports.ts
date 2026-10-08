import "server-only";
import { query, queryOne } from "../db";
import type { EnergyVertical } from "../energia";
import { billingForMonth } from "./billing";

export type Breakdown = { key: string; leads: number; won: number };

export type DespachosReport = {
  leads: number; prev_leads: number; tests: number; sin_despacho: number; cualificados: number; contactados: number;
  speed_min: number | null; citas: number; asistidas: number; no_asistio: number; facturacion: number; clientes_activos: number;
  llamadas_b2b: number; prospectos_interesados: number; clientes_nuevos: number;
  campaigns: Breakdown[]; provinces: Breakdown[];
};

export type EnergyReport = {
  vertical: EnergyVertical; leads: number; prev_leads: number; contactados: number; speed_min: number | null; estudios: number;
  contratados: number; contratados_de_mes: number; comision: number; prev_comision: number; sin_llamar_24h: number;
  priority: { key: string; leads: number; won: number }[]; channels: Breakdown[]; campaigns: Breakdown[]; provinces: Breakdown[];
  lost: { key: string; n: number }[];
};

export type Report = { month: string; despachos: DespachosReport; luz: EnergyReport; placas: EnergyReport; weeks: { week: string; despachos: number; luz: number; placas: number }[] };

const range = `($1 || '-01')::date`;
const stop = `(($1 || '-01')::date + interval '1 month')`;

async function despachos(month: string): Promise<DespachosReport> {
  const k = await queryOne<Omit<DespachosReport, "facturacion" | "clientes_activos" | "campaigns" | "provinces">>(
    `SELECT
       (SELECT count(*) FROM leads WHERE created_at >= ${range} AND created_at < ${stop} AND status <> 'duplicado')::int leads,
       (SELECT count(*) FROM leads WHERE created_at >= ${range} - interval '1 month' AND created_at < ${range} AND status <> 'duplicado')::int prev_leads,
       (SELECT count(*) FROM test_submissions WHERE created_at >= ${range} AND created_at < ${stop})::int tests,
       (SELECT count(*) FROM test_submissions WHERE created_at >= ${range} AND created_at < ${stop} AND client_id IS NULL AND verdict <> 'no_apto')::int sin_despacho,
       (SELECT count(*) FROM leads WHERE created_at >= ${range} AND created_at < ${stop} AND qualification_status = 'cualificado')::int cualificados,
       (SELECT count(*) FROM leads WHERE created_at >= ${range} AND created_at < ${stop} AND first_contact_at IS NOT NULL)::int contactados,
       (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (fc.t - l.created_at)) / 60)
          FROM leads l JOIN LATERAL (SELECT min(created_at) t FROM calls WHERE lead_id = l.id) fc ON fc.t IS NOT NULL
         WHERE l.created_at >= ${range} AND l.created_at < ${stop} AND l.source <> 'reactivacion') speed_min,
       (SELECT count(*) FROM consultations WHERE scheduled_at >= ${range} AND scheduled_at < ${stop} AND status <> 'cancelada')::int citas,
       (SELECT count(*) FROM consultations WHERE scheduled_at >= ${range} AND scheduled_at < ${stop} AND status = 'asistida')::int asistidas,
       (SELECT count(*) FROM consultations WHERE scheduled_at >= ${range} AND scheduled_at < ${stop} AND status = 'no_asistio')::int no_asistio,
       (SELECT count(*) FROM prospect_activities WHERE created_at >= ${range} AND created_at < ${stop} AND kind = 'llamada')::int llamadas_b2b,
       (SELECT count(*) FROM prospects WHERE status IN ('interesado','reunion','propuesta'))::int prospectos_interesados,
       (SELECT count(*) FROM clients WHERE created_at >= ${range} AND created_at < ${stop})::int clientes_nuevos`,
    [month],
  );
  const by = (col: string) =>
    query<Breakdown>(
      `SELECT coalesce(${col}, '—') AS key, count(*)::int leads,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM consultations c WHERE c.lead_id = l.id AND c.status <> 'cancelada'))::int won
         FROM leads l WHERE created_at >= ${range} AND created_at < ${stop} AND status <> 'duplicado'
        GROUP BY 1 ORDER BY leads DESC LIMIT 8`,
      [month],
    );
  const billing = await billingForMonth(month);
  return {
    ...k!,
    facturacion: billing.reduce((a, b) => a + b.total, 0),
    clientes_activos: billing.filter((b) => b.status === "activo").length,
    campaigns: await by("l.campaign"),
    provinces: await by("l.province"),
  };
}

async function energy(month: string, v: EnergyVertical): Promise<EnergyReport> {
  const p = [month, v];
  const base = `FROM energy_leads WHERE vertical = $2 AND created_at >= ${range} AND created_at < ${stop}`;
  const k = await queryOne<Pick<EnergyReport, "leads" | "prev_leads" | "contactados" | "speed_min" | "estudios" | "contratados" | "contratados_de_mes" | "comision" | "prev_comision" | "sin_llamar_24h">>(
    `SELECT
       (SELECT count(*) ${base})::int leads,
       (SELECT count(*) FROM energy_leads WHERE vertical = $2 AND created_at >= ${range} - interval '1 month' AND created_at < ${range})::int prev_leads,
       (SELECT count(*) ${base} AND first_contact_at IS NOT NULL)::int contactados,
       (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (first_contact_at - created_at)) / 60) ${base} AND first_contact_at IS NOT NULL) speed_min,
       (SELECT count(*) ${base} AND status IN ('estudio_enviado','contratado'))::int estudios,
       (SELECT count(*) FROM energy_leads WHERE vertical = $2 AND converted_at >= ${range} AND converted_at < ${stop})::int contratados,
       (SELECT count(*) ${base} AND status = 'contratado')::int contratados_de_mes,
       (SELECT coalesce(sum(commission), 0) FROM energy_leads WHERE vertical = $2 AND converted_at >= ${range} AND converted_at < ${stop}) comision,
       (SELECT coalesce(sum(commission), 0) FROM energy_leads WHERE vertical = $2 AND converted_at >= ${range} - interval '1 month' AND converted_at < ${range}) prev_comision,
       (SELECT count(*) FROM energy_leads WHERE vertical = $2 AND status = 'nuevo' AND created_at < now() - interval '24 hours')::int sin_llamar_24h`,
    p,
  );
  const by = (col: string, limit = 8) =>
    query<Breakdown>(
      `SELECT coalesce(${col}, '—') AS key, count(*)::int leads, count(*) FILTER (WHERE status = 'contratado')::int won
         ${base} GROUP BY 1 ORDER BY leads DESC LIMIT ${limit}`,
      p,
    );
  return {
    vertical: v,
    ...k!,
    priority: await query(`SELECT priority AS key, count(*)::int leads, count(*) FILTER (WHERE status = 'contratado')::int won ${base} GROUP BY 1 ORDER BY 1`, p),
    channels: await by("channel"),
    campaigns: await by("campaign"),
    provinces: await by("province"),
    lost: await query(`SELECT coalesce(lost_reason, 'Sin motivo') AS key, count(*)::int n ${base} AND status = 'descartado' GROUP BY 1 ORDER BY n DESC`, p),
  };
}

export async function buildReport(month: string): Promise<Report> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mes no válido (YYYY-MM)");
  const weeks = await query<{ week: string; despachos: number; luz: number; placas: number }>(
    `WITH w AS (SELECT generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') AS s)
     SELECT to_char(w.s, 'DD/MM') AS week,
       (SELECT count(*) FROM leads l WHERE l.created_at >= w.s AND l.created_at < w.s + interval '1 week' AND l.status <> 'duplicado')::int despachos,
       (SELECT count(*) FROM energy_leads e WHERE e.vertical = 'luz' AND e.created_at >= w.s AND e.created_at < w.s + interval '1 week')::int luz,
       (SELECT count(*) FROM energy_leads e WHERE e.vertical = 'placas' AND e.created_at >= w.s AND e.created_at < w.s + interval '1 week')::int placas
     FROM w ORDER BY w.s`,
  );
  return { month, despachos: await despachos(month), luz: await energy(month, "luz"), placas: await energy(month, "placas"), weeks };
}

