import "server-only";
import { query, queryOne } from "../db";
import { billingForMonth } from "./billing";

export type ClientKind = "despacho" | "linea";

export type Marker = { id: string; label: string; unit: "num" | "eur"; billable: boolean; value: number; position: number };

export type LineClientBilling = {
  client_id: string;
  cliente: string;
  line_id: string;
  line_slug: string;
  line_name: string;
  line_emoji: string;
  won_label: string;
  status: string;
  monthly_fee: number;
  price_per_showup: number;
  price_per_sale: number;
  leads: number;
  contactados: number;
  showups: number;
  ventas: number;
  importe_fijo: number;
  importe_showups: number;
  importe_ventas: number;
  marcadores: number;
  total: number;
};

const DEFAULTS: Record<ClientKind, Omit<Marker, "id" | "value">[]> = {
  despacho: [
    { label: "Casos firmados", unit: "num", billable: false, position: 1 },
    { label: "Comisiones extra", unit: "eur", billable: true, position: 2 },
  ],
  linea: [
    { label: "Ventas fuera de la app", unit: "num", billable: false, position: 1 },
    { label: "Comisiones extra", unit: "eur", billable: true, position: 2 },
  ],
};

/**
 * Marcadores del cliente en ese mes. La primera vez que se abre un mes se crean con los mismos nombres
 * que el mes anterior (o los de serie) a 0, para que no haya que volver a añadirlos.
 */
export async function markersFor(kind: ClientKind, clientId: string, month: string): Promise<Marker[]> {
  const rows = await query<Marker>(
    "SELECT id, label, unit, billable, value, position FROM client_markers WHERE client_kind = $1 AND client_id = $2 AND month = $3 ORDER BY position, label",
    [kind, clientId, month],
  );
  if (rows.length) return rows;
  const prev = await query<Omit<Marker, "id" | "value">>(
    `SELECT label, unit, billable, position FROM client_markers
      WHERE client_kind = $1 AND client_id = $2 AND month = (SELECT max(month) FROM client_markers WHERE client_kind = $1 AND client_id = $2 AND month < $3)`,
    [kind, clientId, month],
  );
  for (const m of prev.length ? prev : DEFAULTS[kind]) {
    await query(
      `INSERT INTO client_markers(client_kind, client_id, month, label, unit, billable, position) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [kind, clientId, month, m.label, m.unit, m.billable, m.position],
    );
  }
  return query<Marker>(
    "SELECT id, label, unit, billable, value, position FROM client_markers WHERE client_kind = $1 AND client_id = $2 AND month = $3 ORDER BY position, label",
    [kind, clientId, month],
  );
}

/** Suma de los marcadores en euros que se facturan, por cliente. */
async function billableMarkers(kind: ClientKind, month: string) {
  const rows = await query<{ client_id: string; total: number }>(
    "SELECT client_id, sum(value) total FROM client_markers WHERE client_kind = $1 AND month = $2 AND billable AND unit = 'eur' GROUP BY client_id",
    [kind, month],
  );
  return new Map(rows.map((r) => [r.client_id, r.total]));
}

/** Despachos: lo de siempre (fijo + consultas realizadas × precio) más los marcadores que se facturan. */
export async function despachoBilling(month: string, clientId?: string) {
  const [rows, extra] = await Promise.all([billingForMonth(month, clientId), billableMarkers("despacho", month)]);
  return rows.map((r) => ({ ...r, marcadores: extra.get(r.client_id) ?? 0, total_con_marcadores: r.total + (extra.get(r.client_id) ?? 0) }));
}

/** Clientes de las demás líneas: fijo + show-ups × precio + ventas (importe del lead o precio por venta) + marcadores. */
export async function lineClientBilling(month: string, clientId?: string): Promise<LineClientBilling[]> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mes no válido (YYYY-MM)");
  const rows = await query<Omit<LineClientBilling, "importe_fijo" | "importe_showups" | "marcadores" | "total">>(
    `WITH m AS (SELECT ($1 || '-01')::date AS start, (($1 || '-01')::date + interval '1 month') AS stop)
     SELECT lc.id AS client_id, lc.name AS cliente, bl.id AS line_id, bl.slug AS line_slug, bl.name AS line_name, bl.emoji AS line_emoji,
            bl.won_label, lc.status, lc.monthly_fee, lc.price_per_showup, lc.price_per_sale,
       (SELECT count(*) FROM line_leads ll, m WHERE ll.client_id = lc.id AND ll.created_at >= m.start AND ll.created_at < m.stop)::int leads,
       (SELECT count(*) FROM line_leads ll, m WHERE ll.client_id = lc.id AND ll.created_at >= m.start AND ll.created_at < m.stop AND ll.first_contact_at IS NOT NULL)::int contactados,
       (SELECT count(*) FROM line_leads ll, m WHERE ll.client_id = lc.id AND ll.showup_at >= m.start AND ll.showup_at < m.stop)::int showups,
       (SELECT count(*) FROM line_leads ll, m WHERE ll.client_id = lc.id AND ll.won_at >= m.start AND ll.won_at < m.stop)::int ventas,
       (SELECT coalesce(sum(coalesce(ll.value, lc.price_per_sale)), 0) FROM line_leads ll, m WHERE ll.client_id = lc.id AND ll.won_at >= m.start AND ll.won_at < m.stop) importe_ventas
     FROM line_clients lc JOIN business_lines bl ON bl.id = lc.line_id, m
     WHERE (lc.status <> 'baja' OR EXISTS (SELECT 1 FROM line_leads ll WHERE ll.client_id = lc.id AND ll.won_at >= m.start AND ll.won_at < m.stop))
       AND lc.started_at < m.stop AND ($2::uuid IS NULL OR lc.id = $2)
     ORDER BY bl.position, lc.name`,
    [month, clientId ?? null],
  );
  const extra = await billableMarkers("linea", month);
  return rows.map((r) => {
    const importe_fijo = r.status === "activo" ? r.monthly_fee : 0;
    const importe_showups = r.showups * r.price_per_showup;
    const marcadores = extra.get(r.client_id) ?? 0;
    return { ...r, importe_fijo, importe_showups, marcadores, total: importe_fijo + importe_showups + r.importe_ventas + marcadores };
  });
}

export async function lineClient(id: string) {
  return queryOne<{
    id: string; line_id: string; name: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null;
    status: string; monthly_fee: number; price_per_showup: number; price_per_sale: number; notes: string | null; started_at: string;
    data: Record<string, string>; lead_id: string | null;
  }>("SELECT * FROM line_clients WHERE id = $1", [id]);
}
