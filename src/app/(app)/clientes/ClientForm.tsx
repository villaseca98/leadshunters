import { Field, btn, input } from "@/components/ui";
import { AiCaseField, CreateButton } from "@/components/AiCaseField";
import { PLANS, PLAN_IDS } from "@/lib/plans";

export type ClientData = {
  name: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null; notify_email: string | null;
  city: string | null; provinces: string[]; status: string; plan: string; monthly_fee: number; price_per_consultation: number;
  max_billable_per_month: number | null; min_debt: number; min_creditors: number; calendar_url: string | null;
  meta_form_ids: string[]; google_form_ids: string[]; started_at: string; notes: string | null; ad_spend_month: number | null; google_review_url: string | null;
  vertical: string; brand: string | null; web_form_ids: string[]; price_per_lead: number | null; price_per_sale: number | null;
  sale_commission_pct: number | null; min_monthly_bill: number | null; accept_hours: number;
};

// Muestra solo los bloques de la línea elegida, sin JavaScript
const SWITCH_CSS = `
form.cliente:has(select[name=vertical] option[value=lso]:checked) .solo-energia,
form.cliente:not(:has(select[name=vertical] option[value=lso]:checked)) .solo-lso { display: none; }
form.cliente:not(:has(select[name=vertical] option[value=placas]:checked)) .solo-placas { display: none; }
form.cliente:not(:has(select[name=vertical] option[value=luz]:checked)) .solo-luz { display: none; }`;

export function ClientForm({ action, c, submit, ai }: { action: (fd: FormData) => void; c?: Partial<ClientData>; submit: string; ai?: boolean }) {
  return (
    <form action={action} className="cliente space-y-6">
      <style>{SWITCH_CSS}</style>
      {ai && <AiCaseField />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Línea de negocio" hint="Despacho LSO: citas. Luz y placas: oportunidades y comisiones">
          <select name="vertical" defaultValue={c?.vertical ?? "lso"} className={input}>
            <option value="lso">Segunda Oportunidad (despacho)</option>
            <option value="luz">Luz de negocios (comercializadora o tu cuenta de agente)</option>
            <option value="placas">Placas solares (instalador)</option>
          </select>
        </Field>
        <Field label="Marca con la que se llama" hint="La que oye el lead: p. ej. Recorta. Vacío = el nombre del cliente"><input name="brand" defaultValue={c?.brand ?? ""} className={input} /></Field>
        <div />
        <div className="sm:col-span-2"><Field label="Nombre del cliente *" hint="Despacho, comercializadora o instalador"><input name="name" required defaultValue={c?.name} className={input} /></Field></div>
        <Field label="Estado">
          <select name="status" defaultValue={c?.status ?? "activo"} className={input}>
            <option value="activo">Activo</option><option value="pausado">Pausado (no entra en cola)</option><option value="baja">Baja</option>
          </select>
        </Field>
        <Field label="Persona de contacto"><input name="contact_name" defaultValue={c?.contact_name ?? ""} className={input} /></Field>
        <Field label="Teléfono"><input name="contact_phone" defaultValue={c?.contact_phone ?? ""} className={input} /></Field>
        <Field label="Email de contacto"><input name="contact_email" type="email" defaultValue={c?.contact_email ?? ""} className={input} /></Field>
        <Field label="Email para avisos" hint="Donde n8n manda cada cita (despachos) u oportunidad (luz y placas) con su enlace"><input name="notify_email" type="email" defaultValue={c?.notify_email ?? ""} className={input} /></Field>
        <Field label="Ciudad"><input name="city" defaultValue={c?.city ?? ""} className={input} /></Field>
        <Field label="Provincias que atiende" hint="Separadas por comas. Vacío = toda España"><input name="provinces" defaultValue={c?.provinces?.join(", ") ?? ""} className={input} /></Field>
      </div>

      <div className="solo-energia">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Condiciones económicas (luz y placas)</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Fijo mensual (€)" hint="Normalmente 0"><input name="monthly_fee_energia" type="number" step="0.01" defaultValue={c?.vertical && c.vertical !== "lso" ? c.monthly_fee : 0} className={input} /></Field>
          <div className="solo-placas"><Field label="Por lead aceptado (€)" hint="Lo paga el instalador si no lo rechaza a tiempo"><input name="price_per_lead" type="number" step="0.01" defaultValue={c?.price_per_lead ?? ""} className={input} /></Field></div>
          <Field label="Por venta (€)" hint="Luz: comisión por contrato activado. Placas: fijo por obra firmada"><input name="price_per_sale" type="number" step="0.01" defaultValue={c?.price_per_sale ?? ""} className={input} /></Field>
          <div className="solo-placas"><Field label="% sobre la obra firmada" hint="Habitual 2-5 %"><input name="sale_commission_pct" type="number" step="0.01" defaultValue={c?.sale_commission_pct ?? ""} className={input} /></Field></div>
          <div className="solo-placas"><Field label="Horas para rechazar un lead" hint="Pasado el plazo cuenta como aceptado"><input name="accept_hours" type="number" defaultValue={c?.accept_hours ?? 72} className={input} /></Field></div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Luz: cobras cuando el suministro queda activado. Placas: cobras cada lead que el instalador no rechaza en su plazo y, además, un % de cada obra firmada.
        </p>
      </div>

      <div className="solo-energia">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Criterios de cualificación</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Factura mínima (€/mes)" hint="Luz: 60 € por defecto. Placas: 80 €"><input name="min_monthly_bill" type="number" step="0.01" defaultValue={c?.min_monthly_bill ?? ""} className={input} /></Field>
        </div>
      </div>

      <div className="solo-lso">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Condiciones económicas</h3>
        <div className="mb-3">
          <Field label="Plan" hint="Fija la cuota y el precio por consulta. Elige Personalizado para poner otros precios.">
            <select name="plan" defaultValue={c?.plan ?? "esencial"} className={input}>
              {PLAN_IDS.map((id) => <option key={id} value={id}>{PLANS[id].name} · {PLANS[id].fee} €/mes + {PLANS[id].perConsultation} € por consulta{PLANS[id].exclusive ? " · exclusividad provincial" : ""}</option>)}
              <option value="personalizado">Personalizado (los precios de abajo)</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Fijo mensual (€)"><input name="monthly_fee" type="number" step="0.01" defaultValue={c?.monthly_fee ?? 400} className={input} /></Field>
          <Field label="Por consulta realizada (€)" hint="Recomendado 25-35 €"><input name="price_per_consultation" type="number" step="0.01" defaultValue={c?.price_per_consultation ?? 35} className={input} /></Field>
          <Field label="Tope de consultas/mes" hint="Opcional"><input name="max_billable_per_month" type="number" defaultValue={c?.max_billable_per_month ?? ""} className={input} /></Field>
          <Field label="Inicio del servicio"><input name="started_at" type="date" defaultValue={c?.started_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} className={input} /></Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Se factura como servicio de marketing (cuota fija + consultas cualificadas realizadas), nunca como porcentaje de los honorarios del despacho, por el código deontológico de la abogacía.
        </p>
      </div>

      <div className="solo-lso">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Criterios de cualificación</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Deuda mínima (€)"><input name="min_debt" type="number" defaultValue={c?.min_debt ?? 8000} className={input} /></Field>
          <Field label="Acreedores mínimos"><input name="min_creditors" type="number" defaultValue={c?.min_creditors ?? 2} className={input} /></Field>
          <Field label="Enlace a su agenda" hint="Calendly, Google Calendar…"><input name="calendar_url" defaultValue={c?.calendar_url ?? ""} className={input} /></Field>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Formularios de anuncios</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="IDs de formularios de Meta Lead Ads" hint="Separados por comas. Así n8n sabe de qué despacho es cada lead"><input name="meta_form_ids" defaultValue={c?.meta_form_ids?.join(", ") ?? ""} className={input} /></Field>
          <Field label="IDs de formularios de Google Ads" hint="form_id que envía el webhook de Google"><input name="google_form_ids" defaultValue={c?.google_form_ids?.join(", ") ?? ""} className={input} /></Field>
          <Field label="IDs de formularios web propios" hint="Los que manda n8n desde tu web, p. ej. recorta-luz o recorta-placas"><input name="web_form_ids" defaultValue={c?.web_form_ids?.join(", ") ?? ""} className={input} /></Field>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Servicios</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Inversión mensual en anuncios (€)" hint="La paga el despacho a Meta y Google. Sirve para su coste por consulta en el panel y el informe"><input name="ad_spend_month" type="number" step="0.01" defaultValue={c?.ad_spend_month ?? ""} className={input} /></Field>
          <Field label="Enlace para dejar reseña en Google" hint="Ficha de Google del despacho → Pedir reseñas. Se envía tras cada consulta realizada (Premium)"><input name="google_review_url" type="url" defaultValue={c?.google_review_url ?? ""} className={input} /></Field>
        </div>
      </div>

      <Field label="Notas"><textarea name="notes" rows={3} defaultValue={c?.notes ?? ""} className={input} /></Field>
      {ai ? <CreateButton className={btn.primary}>{submit}</CreateButton> : <button className={btn.primary}>{submit}</button>}
    </form>
  );
}
