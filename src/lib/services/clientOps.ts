import "server-only";
// Auditoría mensual y evolución de cada cliente, según su línea.
import { query, queryOne } from "../db";
import type { AuditItem } from "../lineas";
import { shiftMonth } from "../format";
import { despachoBilling, lineClientBilling, type ClientKind } from "./clientMetrics";

/** Lista de comprobación de la línea del cliente (despachos: la de la línea de Segunda Oportunidad). */
export async function auditItemsFor(kind: ClientKind, id: string): Promise<AuditItem[]> {
  const row = kind === "despacho"
    ? await queryOne<{ audit_items: AuditItem[] }>("SELECT audit_items FROM business_lines WHERE kind = 'despachos' LIMIT 1")
    : await queryOne<{ audit_items: AuditItem[] }>("SELECT bl.audit_items FROM line_clients lc JOIN business_lines bl ON bl.id = lc.line_id WHERE lc.id = $1", [id]);
  return row?.audit_items ?? [];
}

export type AuditState = { items: (AuditItem & { done: boolean; note: string | null })[]; score: number | null };

export async function auditFor(kind: ClientKind, id: string, month: string, items?: AuditItem[]): Promise<AuditState> {
  const list = items ?? (await auditItemsFor(kind, id));
  const rows = await query<{ item_key: string; done: boolean; note: string | null }>(
    "SELECT item_key, done, note FROM client_audits WHERE client_kind = $1 AND client_id = $2 AND month = $3",
    [kind, id, month],
  );
  const by = new Map(rows.map((r) => [r.item_key, r]));
  const out = list.map((i) => ({ ...i, done: by.get(i.key)?.done ?? false, note: by.get(i.key)?.note ?? null }));
  return { items: out, score: out.length ? Math.round((100 * out.filter((i) => i.done).length) / out.length) : null };
}

export type EvolutionRow = {
  month: string; leads: number; contactados: number; showups: number; ventas: number; facturacion: number;
  conversion: number | null; auditoria: number | null; extras: number;
};

/** Últimos meses del cliente: lo que entra, lo que se convierte, lo que factura y cómo va su auditoría. */
export async function evolution(kind: ClientKind, id: string, month: string, months = 6): Promise<EvolutionRow[]> {
  const list = Array.from({ length: months }, (_, i) => shiftMonth(month, -(months - 1 - i)));
  const items = await auditItemsFor(kind, id);
  const scores = new Map(
    (await query<{ month: string; done: number }>(
      "SELECT month, count(*) FILTER (WHERE done)::int done FROM client_audits WHERE client_kind = $1 AND client_id = $2 AND month = ANY($3) GROUP BY month",
      [kind, id, list],
    )).map((r) => [r.month, r.done]),
  );
  const rows: EvolutionRow[] = [];
  for (const m of list) {
    const markers = await query<{ total: number }>(
      "SELECT coalesce(sum(value), 0) total FROM client_markers WHERE client_kind = $1 AND client_id = $2 AND month = $3 AND unit = 'num'",
      [kind, id, m],
    );
    const auditoria = items.length && scores.has(m) ? Math.round((100 * (scores.get(m) ?? 0)) / items.length) : null;
    if (kind === "despacho") {
      const [b] = await despachoBilling(m, id);
      const energy = b && b.vertical !== "lso";
      rows.push({
        month: m, leads: b?.leads ?? 0, contactados: energy ? b?.oportunidades ?? 0 : b?.citas_agendadas ?? 0,
        showups: energy ? b?.leads_aceptados ?? 0 : b?.citas_asistidas ?? 0, ventas: energy ? b?.ventas ?? 0 : await casosFirmados(id, m),
        facturacion: b?.total_con_marcadores ?? 0,
        conversion: b?.leads ? Math.round((100 * (energy ? b.ventas : b.citas_asistidas)) / b.leads) : null,
        auditoria, extras: markers[0]?.total ?? 0,
      });
    } else {
      const [b] = await lineClientBilling(m, id);
      rows.push({
        month: m, leads: b?.leads ?? 0, contactados: b?.contactados ?? 0, showups: b?.showups ?? 0, ventas: b?.ventas ?? 0,
        facturacion: b?.total ?? 0, conversion: b?.leads ? Math.round((100 * b.ventas) / b.leads) : null, auditoria, extras: markers[0]?.total ?? 0,
      });
    }
  }
  return rows;
}

/** Despachos: los casos firmados los apunta el despacho en su panel o tú en el marcador «Casos firmados». */
async function casosFirmados(id: string, month: string) {
  const r = await queryOne<{ n: number }>(
    `SELECT ((SELECT count(*) FROM consultations WHERE client_id = $1 AND case_signed AND to_char(scheduled_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') = $2)
           + (SELECT coalesce(sum(value), 0) FROM client_markers WHERE client_kind = 'despacho' AND client_id = $1 AND month = $2 AND lower(label) = 'casos firmados'))::int n`,
    [id, month],
  );
  return r?.n ?? 0;
}

/** Resumen en texto para el asistente IA. */
export async function opsText(kind: ClientKind, id: string, month: string) {
  const [a, ev] = await Promise.all([auditFor(kind, id, month), evolution(kind, id, month, 6)]);
  const audit = a.items.length
    ? `Auditoría de ${month}: ${a.score} % (${a.items.map((i) => `${i.done ? "✓" : "✗"} ${i.label}${i.note ? ` [${i.note}]` : ""}`).join("; ")})`
    : "Sin auditoría definida para su línea.";
  const evo = ev.map((r) => `${r.month}: ${r.leads} leads, ${r.showups} show-ups, ${r.ventas} ventas, ${r.facturacion} €, auditoría ${r.auditoria ?? "—"} %`).join("\n");
  return `${audit}\nEvolución 6 meses:\n${evo}`;
}
