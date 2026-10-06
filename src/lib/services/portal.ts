import "server-only";
import { query, queryOne } from "../db";
import { billingForMonth, type BillingRow } from "./billing";
import { appUrl } from "../appUrl";
import { monthLabel } from "../format";
import { planName } from "../plans";

export type PortalClient = {
  id: string; name: string; plan: string; status: string; portal_token: string;
  ad_spend_month: number | null; google_review_url: string | null; contact_name: string | null; contact_phone: string | null; notify_email: string | null;
};

const COLS = "id, name, plan, status, portal_token, ad_spend_month, google_review_url, contact_name, contact_phone, notify_email";

export async function clientByPortalToken(token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  return queryOne<PortalClient>(`SELECT ${COLS} FROM clients WHERE portal_token = $1 AND status <> 'baja'`, [token]);
}

export const portalLink = (token: string) => `${appUrl()}/portal/${token}`;

export type MonthSummary = {
  month: string;
  billing: BillingRow | null;
  casos_firmados: number;
  honorarios: number;
  inversion_anuncios: number | null;
  coste_total: number;
  coste_por_consulta: number | null;
  retorno: number | null; // honorarios / coste total
};

/** Resumen del mes para el despacho: lo que ha recibido, lo que ha pagado y lo que ha ganado. */
export async function monthSummary(client: Pick<PortalClient, "id" | "ad_spend_month">, month: string): Promise<MonthSummary> {
  const [billing] = await billingForMonth(month, client.id);
  const cases = await queryOne<{ n: number; fees: number }>(
    `SELECT count(*)::int AS n, coalesce(sum(case_fee), 0)::float AS fees FROM consultations
      WHERE client_id = $1 AND case_signed AND to_char(scheduled_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') = $2`,
    [client.id, month],
  );
  const ads = client.ad_spend_month != null ? Number(client.ad_spend_month) : null;
  const cost = (billing?.total ?? 0) + (ads ?? 0);
  const held = billing?.citas_asistidas ?? 0;
  const fees = cases?.fees ?? 0;
  return {
    month, billing: billing ?? null,
    casos_firmados: cases?.n ?? 0, honorarios: fees,
    inversion_anuncios: ads, coste_total: cost,
    coste_por_consulta: held ? cost / held : null,
    retorno: cost && fees ? fees / cost : null,
  };
}

/** Texto corto del informe mensual (WhatsApp/email). */
export function reportText(name: string, plan: string, s: MonthSummary, link: string) {
  const b = s.billing;
  const e = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;
  const lines = [
    `Informe de ${monthLabel(s.month)} · ${name} (plan ${planName(plan)})`,
    "",
    `• Personas interesadas: ${b?.leads ?? 0} (${b?.leads_cualificados ?? 0} cumplen los requisitos)`,
    `• Consultas agendadas: ${b?.citas_agendadas ?? 0}`,
    `• Consultas realizadas: ${b?.citas_asistidas ?? 0} (${b?.citas_no_asistio ?? 0} no se presentaron, no se cobran)`,
    `• Casos firmados: ${s.casos_firmados}${s.honorarios ? ` · ${e(s.honorarios)} en honorarios` : ""}`,
    `• Nuestra factura: ${e(b?.total ?? 0)}${s.inversion_anuncios != null ? ` + ${e(s.inversion_anuncios)} en anuncios` : ""}`,
  ];
  if (s.coste_por_consulta != null) lines.push(`• Coste por consulta realizada: ${e(s.coste_por_consulta)}`);
  if (s.retorno != null) lines.push(`• Retorno: ${s.retorno.toLocaleString("es-ES", { maximumFractionDigits: 1 })} € por cada euro invertido`);
  lines.push("", `Todo el detalle en tu panel: ${link}`);
  return lines.join("\n");
}

export async function activeClientsForReport() {
  return query<PortalClient>(`SELECT ${COLS} FROM clients WHERE status = 'activo' ORDER BY name`);
}
