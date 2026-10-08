import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { displayValue, LOST_REASONS, PRIORITY, statusMap } from "@/lib/lineas";
import { getLine, getLines } from "@/lib/services/lines";
import { dateTime, eur, telHref, waHref } from "@/lib/format";
import { A, Card, Field, PageHeader, StatusBadge, btn, input } from "@/components/ui";
import { changeLineStatus, convertLineLead, eraseLineLead, toggleShowup, updateLineLead } from "../actions";

export default async function LineLeadPage(props: PageProps<"/lineas/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await getUser();
  const l = await queryOne<{
    id: string; line_id: string; full_name: string; phone: string; email: string | null; province: string | null; data: Record<string, string>;
    priority: string; priority_points: number; priority_reasons: string[]; status: string; attempts: number; next_call_at: string;
    first_contact_at: string | null; won_at: string | null; value: number | null; lost_reason: string | null; notes: string | null;
    channel: string; campaign: string | null; consent_text: string; consent_at: string; created_at: string;
    client_id: string | null; showup_at: string | null;
  }>("SELECT * FROM line_leads WHERE id = $1", [id]);
  if (!l) notFound();
  const line = (await getLine(l.line_id))!;
  const lines = await getLines({ includeDespachos: false });
  const clients = await query<{ id: string; name: string; status: string }>("SELECT id, name, status FROM line_clients WHERE line_id = $1 ORDER BY status = 'activo' DESC, name", [l.line_id]);
  const myClient = clients.find((x) => x.id === l.client_id);
  const cola = typeof sp.cola === "string" ? sp.cola : "";
  const queueLine = cola && cola !== "todas" ? cola : "";
  const status = changeLineStatus.bind(null, id, !!cola);
  const st = statusMap(line);
  const firstName = l.full_name.split(/\s+/)[0];
  const waText = `Hola ${firstName}, te escribo de ${line.company_name} por lo que nos pediste en Instagram (${line.name.toLowerCase()}). ¿Te va bien que te llame ahora?`;
  const extras = Object.entries(l.data).filter(([k]) => !line.fields.some((f) => f.key === k));
  const q = queueLine ? <input type="hidden" name="queue_line" value={queueLine} /> : null;

  return (
    <>
      <PageHeader
        title={l.full_name}
        eyebrow={`${line.emoji} ${line.name} · ${line.company_name}${cola ? " · cola de llamadas" : ""}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge map={st} value={l.status} />
            <StatusBadge map={PRIORITY} value={l.priority} />
            <span>{l.channel}{l.campaign ? ` · ${l.campaign}` : ""} · entró {dateTime(l.created_at)}</span>
          </span>
        }
        actions={
          <>
            <a href={telHref(l.phone)} className={btn.hunt}>📞 {l.phone}</a>
            <a href={`${waHref(l.phone)}?text=${encodeURIComponent(waText)}`} target="_blank" className={btn.secondary}>WhatsApp</a>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="space-y-4 xl:col-span-2">
          <Card title={cola ? "Resultado de la llamada (salta al siguiente)" : "Resultado"}>
            <div className="flex flex-wrap gap-2">
              {(["no_contesta", "contactado", "propuesta"] as const).map((s) => (
                <form key={s} action={status}>
                  <input type="hidden" name="status" value={s} />{q}
                  <button className={l.status === s ? btn.primary : btn.secondary}>{st[s].label}</button>
                </form>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form action={status} className="flex items-end gap-2 rounded-2xl bg-emerald-50 p-3">
                <input type="hidden" name="status" value="ganado" />{q}
                <Field label={`${line.value_label} (€)`}><input name="value" inputMode="decimal" defaultValue={l.value ?? line.default_value ?? ""} className={input} /></Field>
                <button className={btn.success}>{line.won_label}</button>
              </form>
              <form action={status} className="flex items-end gap-2 rounded-2xl bg-slate-100 p-3">
                <input type="hidden" name="status" value="descartado" />{q}
                <Field label="Motivo">
                  <select name="lost_reason" defaultValue={l.lost_reason ?? ""} className={input}>
                    {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <button className={btn.secondary}>Descartar</button>
              </form>
            </div>
            <form action={toggleShowup.bind(null, id)} className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-sky-50 p-3">
              <button className={l.showup_at ? btn.success : btn.secondary}>{l.showup_at ? "✓ Se presentó" : "Marcar show-up"}</button>
              <span className="text-xs text-slate-600">
                {l.showup_at ? `Show-up el ${dateTime(l.showup_at)}. Pulsa para quitarlo.` : "Si acudió a la cita o visita con el cliente. Cuenta en lo que le facturas por show-up."}
              </span>
            </form>
            <p className="mt-3 text-xs text-slate-500">
              Intentos: {l.attempts}
              {l.status === "no_contesta" ? ` · próxima llamada ${dateTime(l.next_call_at)}` : ""}
              {l.first_contact_at ? ` · primer contacto ${dateTime(l.first_contact_at)}` : ""}
              {l.won_at ? ` · ${line.won_label.toLowerCase()} ${dateTime(l.won_at)}${l.value != null ? ` (${eur(l.value)})` : ""}` : ""}
              {l.lost_reason && l.status === "descartado" ? ` · descartado: ${l.lost_reason}` : ""}
            </p>
          </Card>

          <Card title="Datos">
            <form action={updateLineLead.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Línea">
                <select name="line_id" defaultValue={line.id} className={input}>
                  {lines.map((x) => <option key={x.id} value={x.id}>{x.emoji} {x.name} · {x.company_name}</option>)}
                </select>
              </Field>
              <Field label="Cliente (si ya lo es)">
                <select name="client_id" defaultValue={l.client_id ?? ""} className={input}>
                  <option value="">Sin cliente</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== "activo" ? ` (${c.status})` : ""}</option>)}
                </select>
              </Field>
              <Field label="Nombre"><input name="full_name" defaultValue={l.full_name} className={input} /></Field>
              <Field label="Teléfono"><input name="phone" defaultValue={l.phone} className={input} /></Field>
              <Field label="Email"><input name="email" type="email" defaultValue={l.email ?? ""} className={input} /></Field>
              <Field label="Provincia"><input name="province" defaultValue={l.province ?? ""} className={input} /></Field>
              {line.fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.type === "select" ? (
                    <select name={`f_${f.key}`} defaultValue={l.data[f.key] ?? ""} className={input}>
                      <option value="">—</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      {l.data[f.key] && !f.options?.some((o) => o.value === l.data[f.key]) && <option value={l.data[f.key]}>{l.data[f.key]}</option>}
                    </select>
                  ) : f.type === "bool" ? (
                    <select name={`f_${f.key}`} defaultValue={l.data[f.key] ?? ""} className={input}>
                      <option value="">—</option><option value="si">Sí</option><option value="no">No</option>
                    </select>
                  ) : (
                    <input name={`f_${f.key}`} defaultValue={l.data[f.key] ?? ""} inputMode={f.type === "number" ? "decimal" : undefined} className={input} />
                  )}
                </Field>
              ))}
              <Field label={`${line.value_label} (€)`}><input name="value" inputMode="decimal" defaultValue={l.value ?? ""} className={input} /></Field>
              <div className="sm:col-span-2">
                <Field label="Notas"><textarea name="notes" rows={3} defaultValue={l.notes ?? ""} className={input} /></Field>
              </div>
              <div className="sm:col-span-2"><button className={btn.primary}>Guardar</button></div>
            </form>
          </Card>
        </div>

        <div className="space-y-4 xl:space-y-6">
          {myClient ? (
            <A href={`/clientes/l/${myClient.id}`}>Ya es cliente: {myClient.name} →</A>
          ) : (
            <form action={convertLineLead.bind(null, id)}>
              <button className={`${btn.success} w-full`}>Convertir en cliente</button>
              <p className="mt-1.5 text-xs text-slate-500">Crea su ficha en Clientes con sus datos y lo marca como {line.won_label.toLowerCase()}.</p>
            </form>
          )}
          <Card title={`Prioridad ${l.priority} · ${l.priority_points} puntos`}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {l.priority_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>
          {extras.length > 0 && (
            <Card title="Otros datos que llegaron">
              <dl className="space-y-1 text-sm">
                {extras.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right">{displayValue(undefined, v)}</dd></div>)}
              </dl>
            </Card>
          )}
          <Card title="Consentimiento">
            <p className="text-sm text-slate-700">{l.consent_text}</p>
            <p className="mt-2 text-xs text-slate-500">Aceptado el {dateTime(l.consent_at)} por {l.channel}.</p>
          </Card>
          <div className="flex flex-wrap gap-3 text-sm">
            <A href={`/lineas?linea=${line.slug}`}>← {line.name}</A>
            {cola && <A href={`/lineas/cola${queueLine ? `?linea=${queueLine}` : ""}`}>Cola de llamadas</A>}
          </div>
          {user?.role === "admin" && (
            <form action={eraseLineLead.bind(null, id)}>
              <button className={`${btn.ghost} text-rose-600`}>Borrar sus datos (lo pide la persona)</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
