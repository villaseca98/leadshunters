// GET /api/v1/billing?month=2026-10 — resumen por cliente para el informe mensual de n8n
// Incluye el enlace a su panel, los casos firmados, el retorno y el texto del informe listo para WhatsApp.
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { billingForMonth } from "@/lib/services/billing";
import { monthSummary, portalLink, reportText } from "@/lib/services/portal";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const u = new URL(req.url).searchParams;
  const month = u.get("month") ?? (() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1); // por defecto, el mes anterior
    return d.toISOString().slice(0, 7);
  })();
  try {
    const rows = await billingForMonth(month);
    const info = await query<{ id: string; name: string; plan: string; notify_email: string | null; contact_email: string | null; contact_name: string | null;
      contact_phone: string | null; portal_token: string | null; ad_spend_month: number | null }>(
      "SELECT id, name, plan, notify_email, contact_email, contact_name, contact_phone, portal_token, ad_spend_month FROM clients",
    );
    const byId = new Map(info.map((e) => [e.id, e]));
    const clients = [];
    for (const r of rows) {
      const c = byId.get(r.client_id)!;
      const s = await monthSummary(c, month);
      const panel = c.portal_token ? portalLink(c.portal_token) : null;
      clients.push({
        ...r,
        email: c.contact_email ?? c.notify_email ?? null,
        contacto: c.contact_name ?? null,
        telefono: c.contact_phone ?? null,
        plan: c.plan,
        panel,
        casos_firmados: s.casos_firmados,
        honorarios: s.honorarios,
        inversion_anuncios: s.inversion_anuncios,
        coste_por_consulta: s.coste_por_consulta,
        retorno: s.retorno,
        texto: reportText(c.name, c.plan, s, panel ?? ""),
      });
    }
    return NextResponse.json({ ok: true, month, clients });
  } catch (e) {
    return bad((e as Error).message);
  }
}
