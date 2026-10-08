import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { ENERGY_STATUS, LOST_REASONS, PRIORITY, PROPERTY } from "@/lib/energia";
import { dateTime, eur, telHref, waHref } from "@/lib/format";
import { A, Card, Field, PageHeader, StatusBadge, btn, input } from "@/components/ui";
import { changeEnergyStatus, eraseEnergyLead, updateEnergyLead } from "../actions";

export default async function EnergyLeadPage(props: PageProps<"/energia/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await getUser();
  const l = await queryOne<{
    id: string; vertical: string; full_name: string; phone: string; email: string | null; province: string | null; monthly_bill: number | null;
    property_type: string | null; owner: boolean | null; supplier: string | null; customer_type: string; priority: string; priority_reasons: string[];
    status: string; attempts: number; first_contact_at: string | null; last_contact_at: string | null; converted_at: string | null;
    commission: number | null; lost_reason: string | null; notes: string | null; channel: string; campaign: string | null;
    consent_text: string; consent_at: string; created_at: string;
  }>("SELECT * FROM energy_leads WHERE id = $1", [id]);
  if (!l) notFound();
  const status = changeEnergyStatus.bind(null, id);
  const firstName = l.full_name.split(/\s+/)[0];
  const waText = l.vertical === "luz"
    ? `Hola ${firstName}, te escribo por el estudio de ahorro en tu factura de la luz que pediste en Instagram. ¿Te va bien que te llame ahora?`
    : `Hola ${firstName}, te escribo por el estudio de placas solares que pediste en Instagram. ¿Te va bien que te llame ahora?`;

  return (
    <>
      <PageHeader
        title={l.full_name}
        eyebrow={l.vertical === "luz" ? "💡 Luz · Recorta" : "☀️ Placas solares · Recorta"}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge map={ENERGY_STATUS} value={l.status} />
            <StatusBadge map={PRIORITY} value={l.priority} />
            <span>{l.channel}{l.campaign ? ` · ${l.campaign}` : ""} · entró {dateTime(l.created_at)}</span>
          </span>
        }
        actions={
          <>
            <a href={telHref(l.phone)} className={btn.hunt}>📞 Llamar</a>
            <a href={`${waHref(l.phone)}?text=${encodeURIComponent(waText)}`} target="_blank" className={btn.secondary}>WhatsApp</a>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Resultado">
            <div className="flex flex-wrap gap-2">
              {(["no_contesta", "contactado", "estudio_enviado"] as const).map((s) => (
                <form key={s} action={status}>
                  <input type="hidden" name="status" value={s} />
                  <button className={l.status === s ? btn.primary : btn.secondary}>{ENERGY_STATUS[s].label}</button>
                </form>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form action={status} className="flex items-end gap-2 rounded-2xl bg-emerald-50 p-3">
                <input type="hidden" name="status" value="contratado" />
                <Field label="Comisión (€)"><input name="commission" inputMode="decimal" defaultValue={l.commission ?? ""} className={input} /></Field>
                <button className={btn.success}>Contratado</button>
              </form>
              <form action={status} className="flex items-end gap-2 rounded-2xl bg-slate-100 p-3">
                <input type="hidden" name="status" value="descartado" />
                <Field label="Motivo">
                  <select name="lost_reason" defaultValue={l.lost_reason ?? ""} className={input}>
                    {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <button className={btn.secondary}>Descartar</button>
              </form>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Intentos: {l.attempts} · primer contacto {l.first_contact_at ? dateTime(l.first_contact_at) : "—"}
              {l.converted_at ? ` · contratado ${dateTime(l.converted_at)}${l.commission != null ? ` (${eur(l.commission)})` : ""}` : ""}
              {l.lost_reason && l.status === "descartado" ? ` · descartado: ${l.lost_reason}` : ""}
            </p>
          </Card>

          <Card title="Datos">
            <form action={updateEnergyLead.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
              <Field label="Línea">
                <select name="vertical" defaultValue={l.vertical} className={input}><option value="luz">Luz</option><option value="placas">Placas solares</option></select>
              </Field>
              <Field label="Nombre"><input name="full_name" defaultValue={l.full_name} className={input} /></Field>
              <Field label="Teléfono"><input name="phone" defaultValue={l.phone} className={input} /></Field>
              <Field label="Email"><input name="email" type="email" defaultValue={l.email ?? ""} className={input} /></Field>
              <Field label="Provincia"><input name="province" defaultValue={l.province ?? ""} className={input} /></Field>
              <Field label="Factura de la luz (€/mes)"><input name="monthly_bill" inputMode="decimal" defaultValue={l.monthly_bill ?? ""} className={input} /></Field>
              <Field label="Vivienda">
                <select name="property_type" defaultValue={l.property_type ?? ""} className={input}>
                  <option value="">—</option>
                  {Object.entries(PROPERTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="¿Propietario?">
                <select name="owner" defaultValue={l.owner == null ? "" : l.owner ? "si" : "no"} className={input}>
                  <option value="">—</option><option value="si">Sí</option><option value="no">No</option>
                </select>
              </Field>
              <Field label="Hogar o negocio">
                <select name="customer_type" defaultValue={l.customer_type} className={input}><option value="hogar">Hogar</option><option value="negocio">Negocio</option></select>
              </Field>
              <Field label="Compañía actual"><input name="supplier" defaultValue={l.supplier ?? ""} className={input} /></Field>
              <Field label="Comisión (€)"><input name="commission" inputMode="decimal" defaultValue={l.commission ?? ""} className={input} /></Field>
              <div className="sm:col-span-2">
                <Field label="Notas"><textarea name="notes" rows={3} defaultValue={l.notes ?? ""} className={input} /></Field>
              </div>
              <div className="sm:col-span-2"><button className={btn.primary}>Guardar</button></div>
            </form>
          </Card>
        </div>

        <div className="space-y-4 xl:space-y-6">
          <Card title={`Prioridad ${l.priority}`}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {l.priority_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>
          <Card title="Consentimiento">
            <p className="text-sm text-slate-700">{l.consent_text}</p>
            <p className="mt-2 text-xs text-slate-500">Aceptado el {dateTime(l.consent_at)} por {l.channel}.</p>
          </Card>
          <div className="flex flex-wrap gap-2">
            <A href={`/energia?linea=${l.vertical}`} className="text-sm">← Volver a {l.vertical === "luz" ? "luz" : "placas"}</A>
          </div>
          {user?.role === "admin" && (
            <form action={eraseEnergyLead.bind(null, id)}>
              <button className={`${btn.ghost} text-rose-600`}>Borrar sus datos (lo pide la persona)</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
