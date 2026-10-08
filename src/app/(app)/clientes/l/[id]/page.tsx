import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { PRIORITY, statusMap } from "@/lib/lineas";
import { getLine } from "@/lib/services/lines";
import { lineClient, lineClientBilling, markersFor } from "@/lib/services/clientMetrics";
import { currentMonth, dateTime, eur, monthLabel } from "@/lib/format";
import { A, Badge, Card, Field, PageHeader, StatusBadge, btn, input } from "@/components/ui";
import { ClientMetrics } from "@/components/ClientMetrics";
import { updateLineClient } from "../../lineActions";
import { ClientAi } from "@/components/ClientAi";
import { aiState, anthropicKey, clientReports } from "@/lib/services/clientAi";

export default async function LineClientPage(props: PageProps<"/clientes/l/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await lineClient(id);
  if (!c) notFound();
  const user = await getUser();
  const line = (await getLine(c.line_id))!;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentMonth();
  const [[b], markers, leads, ai, reports, key] = await Promise.all([
    lineClientBilling(mes, id),
    markersFor("linea", id, mes),
    query<{ id: string; full_name: string; status: string; priority: string; created_at: string; showup_at: string | null; won_at: string | null; value: number | null }>(
      "SELECT id, full_name, status, priority, created_at, showup_at, won_at, value FROM line_leads WHERE client_id = $1 ORDER BY created_at DESC LIMIT 20",
      [id],
    ),
    aiState("linea", id),
    clientReports("linea", id),
    anthropicKey(),
  ]);
  const st = statusMap(line);
  const isAdmin = user?.role === "admin";
  const conditions = [
    c.monthly_fee ? `${eur(c.monthly_fee)}/mes fijo` : null,
    c.price_per_showup ? `${eur(c.price_per_showup)} por show-up` : null,
    c.price_per_sale ? `${eur(c.price_per_sale)} por ${line.won_label.toLowerCase()}` : null,
  ].filter(Boolean);
  const markerTotal = markers.filter((m) => m.unit === "eur" && m.billable).reduce((a, m) => a + m.value, 0);

  return (
    <>
      <PageHeader
        title={c.name}
        eyebrow={`Cliente · ${line.emoji} ${line.name} · ${line.company_name}`}
        subtitle={<span className="flex flex-wrap items-center gap-2"><Badge tone={c.status === "activo" ? "emerald" : c.status === "pausado" ? "amber" : "slate"}>{c.status}</Badge>{conditions.join(" + ") || "Sin condiciones: ponlas en la ficha"}</span>}
        actions={<A href={`/lineas?linea=${line.slug}&cliente=${id}`}>Ver leads →</A>}
      />
      {c.lead_id && <p className="mb-4 text-sm text-slate-600">Vino de este lead: <A href={`/lineas/${c.lead_id}`}>ver el lead</A>.</p>}

      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="space-y-4 xl:col-span-2 xl:space-y-6">
          <ClientAi kind="linea" clientId={id} messages={ai.messages} plan={ai.plan} reports={reports} month={mes} monthName={monthLabel(mes)} hasKey={!!key} fresh={!!sp.nuevo} notice={typeof sp.ia === "string" ? sp.ia : undefined} />
          <ClientMetrics
            kind="linea"
            clientId={id}
            month={mes}
            basePath={`/clientes/l/${id}`}
            markers={markers}
            total={b?.total ?? markerTotal}
            lines={b ? [
              { label: "Fijo mensual", detail: b.status !== "activo" ? `${b.status}, no se cobra` : undefined, amount: b.importe_fijo },
              { label: "Show-ups", detail: `${b.showups} × ${eur(b.price_per_showup)}`, amount: b.importe_showups },
              { label: `${line.won_label} (${line.value_label.toLowerCase()})`, detail: `${b.ventas} en ${monthLabel(mes).split(" ")[0]}${b.price_per_sale ? ` · ${eur(b.price_per_sale)} si el lead no lleva importe` : " · importe de cada lead"}`, amount: b.importe_ventas },
            ] : []}
          >
            <div className="mb-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              {[
                ["Leads", b?.leads ?? 0],
                ["Contactados", b?.contactados ?? 0],
                ["Show-ups", b?.showups ?? 0],
                [line.won_label, b?.ventas ?? 0],
                ["Conversión", b?.leads ? `${Math.round((100 * b.ventas) / b.leads)} %` : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-200 p-2"><div className="num text-lg font-semibold">{v}</div><div className="text-[11px] text-slate-500">{k}</div></div>
              ))}
            </div>
          </ClientMetrics>

          <Card title="Sus leads" flush>
            {leads.length === 0 ? <p className="p-5 text-sm text-slate-500">Todavía no tiene leads asignados.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {leads.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                    <div><A href={`/lineas/${l.id}`}>{l.full_name}</A><div className="text-xs text-slate-500">entró {dateTime(l.created_at)}{l.showup_at ? ` · show-up ${dateTime(l.showup_at)}` : ""}</div></div>
                    <div className="flex items-center gap-2">
                      {l.value != null && l.won_at && <span className="num text-xs font-semibold text-emerald-700">{eur(l.value)}</span>}
                      <StatusBadge map={PRIORITY} value={l.priority} />
                      <StatusBadge map={st} value={l.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 xl:space-y-6">
          <Card title="Ficha y condiciones">
            {isAdmin ? (
              <form action={updateLineClient.bind(null, id)} className="grid gap-3">
                <Field label="Nombre"><input name="name" required defaultValue={c.name} className={input} /></Field>
                <Field label="Estado">
                  <select name="status" defaultValue={c.status} className={input}>
                    <option value="activo">Activo</option><option value="pausado">Pausado</option><option value="baja">Baja</option>
                  </select>
                </Field>
                {line.client_fields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    {f.type === "select" ? (
                      <select name={`c_${f.key}`} defaultValue={c.data[f.key] ?? ""} className={input}>
                        <option value="">—</option>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input name={`c_${f.key}`} defaultValue={c.data[f.key] ?? ""} inputMode={f.type === "number" ? "decimal" : undefined} className={input} />
                    )}
                  </Field>
                ))}
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Fijo €"><input name="monthly_fee" inputMode="decimal" defaultValue={c.monthly_fee || ""} placeholder="0" className={input} /></Field>
                  <Field label="Show-up €"><input name="price_per_showup" inputMode="decimal" defaultValue={c.price_per_showup || ""} placeholder="0" className={input} /></Field>
                  <Field label="Venta €"><input name="price_per_sale" inputMode="decimal" defaultValue={c.price_per_sale || ""} placeholder="0" className={input} /></Field>
                </div>
                <p className="-mt-1 text-xs text-slate-500">€ por venta se usa cuando en el lead no pones su {line.value_label.toLowerCase()}.</p>
                <Field label="Contacto"><input name="contact_name" defaultValue={c.contact_name ?? ""} className={input} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Teléfono"><input name="contact_phone" defaultValue={c.contact_phone ?? ""} className={input} /></Field>
                  <Field label="Email"><input name="contact_email" type="email" defaultValue={c.contact_email ?? ""} className={input} /></Field>
                </div>
                <Field label="Desde"><input name="started_at" type="date" defaultValue={c.started_at} className={input} /></Field>
                <Field label="Notas (cómo te paga, acuerdos…)"><textarea name="notes" rows={3} defaultValue={c.notes ?? ""} className={input} /></Field>
                <button className={btn.primary}>Guardar</button>
              </form>
            ) : <p className="text-sm text-slate-500">Solo un administrador puede editar la ficha.</p>}
          </Card>
          <A href="/clientes">← Todos los clientes</A>
        </div>
      </div>
    </>
  );
}
