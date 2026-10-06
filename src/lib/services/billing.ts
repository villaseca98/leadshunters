import "server-only";
import { query } from "../db";

export type BillingRow = {
  client_id: string;
  cliente: string;
  status: string;
  monthly_fee: number;
  price_per_consultation: number;
  max_billable_per_month: number | null;
  leads: number;
  leads_cualificados: number;
  citas_agendadas: number;
  citas_asistidas: number;
  citas_no_asistio: number;
  citas_pendientes: number;
  consultas_facturables: number;
  importe_fijo: number;
  importe_variable: number;
  total: number;
};

/** month = "YYYY-MM". Fijo mensual + consultas asistidas × precio (con tope opcional). */
export async function billingForMonth(month: string, clientId?: string): Promise<BillingRow[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mes no válido (YYYY-MM)");
  const rows = await query<Omit<BillingRow, "consultas_facturables" | "importe_fijo" | "importe_variable" | "total">>(
    `WITH m AS (SELECT ($1 || '-01')::date AS start, (($1 || '-01')::date + interval '1 month') AS stop)
     SELECT c.id AS client_id, c.name AS cliente, c.status, c.monthly_fee, c.price_per_consultation, c.max_billable_per_month,
       (SELECT count(*) FROM leads l, m WHERE l.client_id = c.id AND l.created_at >= m.start AND l.created_at < m.stop AND l.status <> 'duplicado')::int AS leads,
       (SELECT count(*) FROM leads l, m WHERE l.client_id = c.id AND l.created_at >= m.start AND l.created_at < m.stop AND l.qualification_status = 'cualificado')::int AS leads_cualificados,
       (SELECT count(*) FROM consultations co, m WHERE co.client_id = c.id AND co.scheduled_at >= m.start AND co.scheduled_at < m.stop AND co.status <> 'cancelada')::int AS citas_agendadas,
       (SELECT count(*) FROM consultations co, m WHERE co.client_id = c.id AND co.scheduled_at >= m.start AND co.scheduled_at < m.stop AND co.status = 'asistida')::int AS citas_asistidas,
       (SELECT count(*) FROM consultations co, m WHERE co.client_id = c.id AND co.scheduled_at >= m.start AND co.scheduled_at < m.stop AND co.status = 'no_asistio')::int AS citas_no_asistio,
       (SELECT count(*) FROM consultations co, m WHERE co.client_id = c.id AND co.scheduled_at >= m.start AND co.scheduled_at < m.stop AND co.status = 'agendada')::int AS citas_pendientes
     FROM clients c, m
     WHERE (c.status <> 'baja' OR EXISTS (SELECT 1 FROM consultations co WHERE co.client_id = c.id AND co.scheduled_at >= m.start AND co.scheduled_at < m.stop))
       AND c.started_at < m.stop
       AND ($2::uuid IS NULL OR c.id = $2)
     ORDER BY c.name`,
    [month, clientId ?? null],
  );
  return rows.map((r) => {
    const billable = r.max_billable_per_month != null ? Math.min(r.citas_asistidas, r.max_billable_per_month) : r.citas_asistidas;
    const fijo = r.status === "activo" ? r.monthly_fee : 0;
    const variable = billable * r.price_per_consultation;
    return { ...r, consultas_facturables: billable, importe_fijo: fijo, importe_variable: variable, total: fijo + variable };
  });
}
