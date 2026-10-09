import { planName } from "@/lib/plans";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { billingForMonth } from "@/lib/services/billing";
import { CONSULTATION_STATUS } from "@/lib/labels";
import { currentMonth, dateTime, eur, monthLabel, shiftMonth } from "@/lib/format";
import { monthSummary, reportText } from "@/lib/services/portal";
import { A, Card, PageHeader, Stat, StatusBadge, btn } from "@/components/ui";
import { ClientForm, type ClientData } from "../ClientForm";
import { importOldLeads, rotateClientKey, rotatePortalToken, updateClient } from "../actions";
import { appUrl } from "@/lib/appUrl";
import { ReactivateForm } from "./ReactivateForm";
import { despachoBilling, markersFor } from "@/lib/services/clientMetrics";
import { ClientMetrics } from "@/components/ClientMetrics";
import { VERTICALS, isEnergy } from "@/lib/energy";
import { ClientAi } from "@/components/ClientAi";
import { ClientAudit } from "@/components/ClientAudit";
import { ClientEvolution } from "@/components/ClientEvolution";
import { auditFor, evolution } from "@/lib/services/clientOps";

import { aiState, anthropicKey, clientReports } from "@/lib/services/clientAi";

export default async function ClientePage(props: PageProps<"/clientes/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await getUser();
  const c = await queryOne<ClientData & { id: string; api_key: string; prospect_id: string | null; test_code: string | null; portal_token: string | null; ad_spend_month: number | null }>("SELECT * FROM clients WHERE id = $1", [id]);
  if (!c) notFound();
  const month = currentMonth();
  const [b] = await billingForMonth(month, id);
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : month;
  const [[mb], markers, ai, reports, key] = await Promise.all([despachoBilling(mes, id), markersFor("despacho", id, mes), aiState("despacho", id), clientReports("despacho", id), anthropicKey()]);
  const [audit, evo] = await Promise.all([auditFor("despacho", id, mes), evolution("despacho", id, mes)]);
  const energyLabels = c.vertical === "luz" ? { contactados: "Oportunidades", showups: "Aceptados", ventas: "Activados" } : { contactados: "Oportunidades", showups: "Aceptados", ventas: "Firmadas" };
  const consults = await query<{ id: string; scheduled_at: string; status: string; full_name: string; lead_id: string }>(
    `SELECT co.id, co.scheduled_at, co.status, l.full_name, l.id AS lead_id FROM consultations co JOIN leads l ON l.id = co.lead_id
      WHERE co.client_id = $1 ORDER BY co.scheduled_at DESC LIMIT 15`,
    [id],
  );
  const base = appUrl() || "https://tu-dominio";
  const prevMonth = shiftMonth(month, -1);
  const report = c.portal_token ? reportText(c.name, c.plan, await monthSummary(c, prevMonth), `${base}/portal/${c.portal_token}`) : "";
  const waTo = c.contact_phone ? `https://wa.me/34${c.contact_phone.replace(/\D/g, "").replace(/^34(?=\d{9}$)/, "")}` : null;
  const isAdmin = user?.role === "admin";

  const snippet = `<form id="lh-form">
  <input name="full_name" placeholder="Nombre y apellidos" required>
  <input name="phone" placeholder="Teléfono" required>
  <input name="email" type="email" placeholder="Email">
  <select name="debt_amount"><option>Menos de 8.000 €</option><option>Entre 8.000 y 30.000 €</option><option>Más de 30.000 €</option></select>
  <select name="creditors_count"><option>1</option><option>2</option><option>3 o más</option></select>
  <label><input type="checkbox" name="consent" required> Acepto que me llamen para estudiar mi caso (política de privacidad)</label>
  <button>Quiero que me llamen</button>
</form>
<script>
document.getElementById('lh-form').onsubmit = async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  await fetch('${base}/api/v1/leads', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': '${c.api_key}' },
    body: JSON.stringify({ ...d, source: 'web', consent_text: 'Formulario web ' + location.href }) });
  e.target.innerHTML = '¡Gracias! Te llamamos en unos minutos.';
};
</script>`;

  return (
    <>
      <PageHeader
        title={c.name}
        eyebrow="Cliente"
        subtitle={isEnergy(c.vertical)
          ? `${VERTICALS[c.vertical].label}${c.brand ? ` · marca ${c.brand}` : ""} · ${c.vertical === "placas" ? `${eur(c.price_per_lead ?? 0)} por lead aceptado + ${c.sale_commission_pct ?? 0} % de obra` : `${eur(c.price_per_sale ?? 0)} por contrato activado`} · ${c.status}`
          : `Plan ${planName(c.plan)} · ${eur(c.monthly_fee)}/mes + ${eur(c.price_per_consultation)} por consulta realizada · ${c.status}`}
        actions={
          <>
            <a href={`/api/export/informe?cliente=${id}&mes=${month}`} className={btn.secondary}>Informe del mes (CSV)</a>
            <a href={`/clientes/${id}/publicaciones`} className={btn.secondary}>Instagram</a>
            <A href={`/leads?cliente=${id}`}>Ver leads →</A>
          </>
        }
      />

      <div className="lh-rail -mx-4 mb-5 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:px-0">
        <Stat label="Leads" value={b?.leads ?? 0} hint={monthLabel(month)} />
        <Stat label="Cualificados" value={b?.leads_cualificados ?? 0} />
        <Stat label="Consultas agendadas" value={b?.citas_agendadas ?? 0} />
        <Stat label="Realizadas" value={b?.citas_asistidas ?? 0} tone="good" hint={`${b?.citas_no_asistio ?? 0} no asistieron`} />
        <Stat label="A facturar" value={eur(b?.total ?? 0)} hint={`${eur(b?.importe_fijo ?? 0)} + ${eur(b?.importe_variable ?? 0)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="space-y-4 xl:col-span-2 xl:space-y-6">
          <ClientAi kind="despacho" clientId={id} messages={ai.messages} plan={ai.plan} reports={reports} month={mes} monthName={monthLabel(mes)} hasKey={!!key} fresh={!!sp.nuevo} notice={typeof sp.ia === "string" ? sp.ia : undefined} />
          <ClientMetrics
            kind="despacho"
            clientId={id}
            month={mes}
            basePath={`/clientes/${id}`}
            markers={markers}
            total={mb?.total_con_marcadores ?? markers.filter((m) => m.unit === "eur" && m.billable).reduce((a, m) => a + m.value, 0)}
            lines={mb && isEnergy(c.vertical) ? [
              { label: "Fijo mensual", detail: mb.status !== "activo" ? `${mb.status}, no se cobra` : undefined, amount: mb.importe_fijo },
              ...(c.vertical === "placas" ? [{ label: "Leads aceptados", detail: `${mb.leads_aceptados} × ${eur(mb.price_per_lead ?? 0)} · ${mb.leads_rechazados} rechazados`, amount: mb.por_leads }] : []),
              { label: c.vertical === "luz" ? "Contratos activados" : "Obras firmadas", detail: `${mb.ventas} × ${eur(mb.price_per_sale ?? 0)}`, amount: mb.por_ventas },
              ...(c.vertical === "placas" ? [{ label: "% de obra", detail: `${mb.sale_commission_pct ?? 0} % de ${eur(mb.importe_obras)}`, amount: mb.por_comision }] : []),
            ] : mb ? [
              { label: "Cuota fija", detail: `Plan ${planName(c.plan)}${mb.status !== "activo" ? ` · ${mb.status}, no se cobra` : ""}`, amount: mb.importe_fijo },
              {
                label: "Consultas realizadas (show-ups)",
                detail: `${mb.consultas_facturables} × ${eur(mb.price_per_consultation)}${mb.citas_gratis_retraso ? ` · ${mb.citas_gratis_retraso} gratis por llamada tardía` : ""}${mb.max_billable_per_month != null && mb.citas_asistidas > mb.max_billable_per_month ? ` · tope ${mb.max_billable_per_month}` : ""}`,
                amount: mb.importe_variable,
              },
            ] : []}
          >
            <div className="mb-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              {(isEnergy(c.vertical) ? [
                ["Leads", mb?.leads ?? 0],
                ["Oportunidades", mb?.oportunidades ?? 0],
                ["Aceptados", c.vertical === "placas" ? mb?.leads_aceptados ?? 0 : "—"],
                [c.vertical === "luz" ? "Activados" : "Firmadas", mb?.ventas ?? 0],
                ["Conversión", mb?.leads ? `${Math.round((100 * mb.ventas) / mb.leads)} %` : "—"],
              ] : [
                ["Leads", mb?.leads ?? 0],
                ["Agendadas", mb?.citas_agendadas ?? 0],
                ["Show-ups", mb?.citas_asistidas ?? 0],
                ["No-shows", mb?.citas_no_asistio ?? 0],
                ["Show-up %", mb && mb.citas_asistidas + mb.citas_no_asistio ? `${Math.round((100 * mb.citas_asistidas) / (mb.citas_asistidas + mb.citas_no_asistio))} %` : "—"],
              ]).map(([k, v]) => (
                <div key={String(k)} className="rounded-xl border border-slate-200 p-2"><div className="num text-lg font-semibold">{v}</div><div className="text-[11px] text-slate-500">{k}</div></div>
              ))}
            </div>
          </ClientMetrics>
          <ClientEvolution rows={evo} labels={isEnergy(c.vertical) ? energyLabels : { contactados: "Agendadas", showups: "Consultas hechas", ventas: "Casos firmados" }} />
          {!isEnergy(c.vertical) && <ClientAudit kind="despacho" clientId={id} month={mes} monthName={monthLabel(mes)} items={audit.items} history={evo.map((r) => ({ month: r.month, score: r.auditoria }))} />}
          <Card title="Ficha y condiciones">
            {isAdmin ? <ClientForm action={updateClient.bind(null, id)} c={c} submit="Guardar cambios" /> : <p className="text-sm text-slate-500">Solo un administrador puede editar la ficha.</p>}
          </Card>
        </div>
        <div className="space-y-4 xl:space-y-6">
          <Card title="Últimas consultas" actions={<A href={`/citas?cliente=${id}`} className="text-xs">Todas</A>}>
            {consults.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay consultas.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {consults.map((x) => (
                  <li key={x.id} className="flex items-center justify-between py-2">
                    <div><A href={`/leads/${x.lead_id}`}>{x.full_name}</A><div className="text-xs text-slate-500">{dateTime(x.scheduled_at)}</div></div>
                    <StatusBadge map={CONSULTATION_STATUS} value={x.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {c.portal_token && (
            <Card title="Panel del despacho" actions={isAdmin ? <form action={rotatePortalToken.bind(null, id)}><button className={btn.ghost}>Nuevo enlace</button></form> : undefined}>
              <p className="text-sm text-slate-600">Enlace privado para el despacho: ve sus consultas, confirma las realizadas, marca los casos firmados y ve lo que gana frente a lo que paga. Va también en el informe mensual.</p>
              <div className="mt-2 select-all break-all rounded-xl bg-slate-50 p-2.5 font-mono text-xs">{base}/portal/{c.portal_token}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/portal/${c.portal_token}`} target="_blank" className={btn.secondary}>Ver su panel ↗</a>
                {waTo && <a href={`${waTo}?text=${encodeURIComponent(`Hola${c.contact_name ? ` ${c.contact_name.split(" ")[0]}` : ""}, este es tu panel con tus consultas y resultados: ${base}/portal/${c.portal_token}`)}`} target="_blank" className={btn.secondary}>Enviar panel</a>}
                {waTo && <a href={`${waTo}?text=${encodeURIComponent(report)}`} target="_blank" className={btn.secondary}>Informe de {monthLabel(prevMonth).split(" ")[0]} por WhatsApp</a>}
              </div>
            </Card>
          )}
          {c.test_code && (
            <Card title="Test para sus anuncios">
              <p className="text-sm text-slate-600">Página del test con el nombre del despacho. Úsala en los anuncios que salen desde su página de Facebook (historias y feed de Instagram y Facebook). Cada respuesta entra directa en su cola.</p>
              <div className="mt-2 select-all break-all rounded-xl bg-slate-50 p-2.5 font-mono text-xs">{base}/test/{c.test_code}?utm_source=facebook&amp;utm_campaign=historias</div>
              <a href={`/test/${c.test_code}`} target="_blank" className={`${btn.secondary} mt-3`}>Ver el test ↗</a>
            </Card>
          )}
          {isAdmin && (
            <Card title="Reactivar leads antiguos">
              <p className="text-sm text-slate-600">Sube en CSV los contactos que el despacho no llegó a cerrar. Columnas: nombre, teléfono y, si las tiene, email, provincia, deuda y acreedores. Entran en la cola detrás de los leads de los anuncios.</p>
              <div className="mt-3"><ReactivateForm action={importOldLeads.bind(null, id)} /></div>
            </Card>
          )}
          {isAdmin && (
            <Card title="Integración" actions={<form action={rotateClientKey.bind(null, id)}><button className={btn.ghost}>Regenerar clave</button></form>}>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs text-slate-500">ID de cliente (para n8n)</dt><dd className="break-all font-mono text-xs">{id}</dd></div>
                <div><dt className="text-xs text-slate-500">Clave de cliente (formularios web)</dt><dd className="break-all font-mono text-xs">{c.api_key}</dd></div>
                <div><dt className="text-xs text-slate-500">Endpoint</dt><dd className="break-all font-mono text-xs">POST {base}/api/v1/leads</dd></div>
              </dl>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-indigo-600">Formulario para su web (copiar y pegar)</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-slate-100">{snippet}</pre>
              </details>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
