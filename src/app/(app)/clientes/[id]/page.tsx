import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { billingForMonth } from "@/lib/services/billing";
import { CONSULTATION_STATUS } from "@/lib/labels";
import { currentMonth, dateTime, eur, monthLabel } from "@/lib/format";
import { A, Card, PageHeader, Stat, StatusBadge, btn } from "@/components/ui";
import { ClientForm, type ClientData } from "../ClientForm";
import { rotateClientKey, updateClient } from "../actions";
import { appUrl } from "@/lib/appUrl";

export default async function ClientePage(props: PageProps<"/clientes/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await getUser();
  const c = await queryOne<ClientData & { id: string; api_key: string; prospect_id: string | null; test_code: string | null }>("SELECT * FROM clients WHERE id = $1", [id]);
  if (!c) notFound();
  const month = currentMonth();
  const [b] = await billingForMonth(month, id);
  const consults = await query<{ id: string; scheduled_at: string; status: string; full_name: string; lead_id: string }>(
    `SELECT co.id, co.scheduled_at, co.status, l.full_name, l.id AS lead_id FROM consultations co JOIN leads l ON l.id = co.lead_id
      WHERE co.client_id = $1 ORDER BY co.scheduled_at DESC LIMIT 15`,
    [id],
  );
  const base = appUrl() || "https://tu-dominio";
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
        subtitle={`${eur(c.monthly_fee)}/mes + ${eur(c.price_per_consultation)} por consulta realizada · ${c.status}`}
        actions={
          <>
            <a href={`/api/export/informe?cliente=${id}&mes=${month}`} className={btn.secondary}>Informe del mes (CSV)</a>
            <A href={`/leads?cliente=${id}`}>Ver leads →</A>
          </>
        }
      />
      {sp.nuevo && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ¡Nuevo cliente! Revisa sus condiciones, añade los IDs de sus formularios de Meta/Google y el email para avisos.
        </p>
      )}

      <div className="lh-rail -mx-4 mb-5 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:px-0">
        <Stat label="Leads" value={b?.leads ?? 0} hint={monthLabel(month)} />
        <Stat label="Cualificados" value={b?.leads_cualificados ?? 0} />
        <Stat label="Consultas agendadas" value={b?.citas_agendadas ?? 0} />
        <Stat label="Realizadas" value={b?.citas_asistidas ?? 0} tone="good" hint={`${b?.citas_no_asistio ?? 0} no asistieron`} />
        <Stat label="A facturar" value={eur(b?.total ?? 0)} hint={`${eur(b?.importe_fijo ?? 0)} + ${eur(b?.importe_variable ?? 0)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="xl:col-span-2">
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
          {c.test_code && (
            <Card title="Test para sus anuncios">
              <p className="text-sm text-slate-600">Página del test con el nombre del despacho. Úsala en los anuncios que salen desde su página de Facebook (historias y feed de Instagram y Facebook). Cada respuesta entra directa en su cola.</p>
              <div className="mt-2 select-all break-all rounded-xl bg-slate-50 p-2.5 font-mono text-xs">{base}/test/{c.test_code}?utm_source=facebook&amp;utm_campaign=historias</div>
              <a href={`/test/${c.test_code}`} target="_blank" className={`${btn.secondary} mt-3`}>Ver el test ↗</a>
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
