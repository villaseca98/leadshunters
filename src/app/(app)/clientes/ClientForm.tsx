import { Field, btn, input } from "@/components/ui";
import { PLANS, PLAN_IDS } from "@/lib/plans";

export type ClientData = {
  name: string; contact_name: string | null; contact_phone: string | null; contact_email: string | null; notify_email: string | null;
  city: string | null; provinces: string[]; status: string; plan: string; monthly_fee: number; price_per_consultation: number;
  max_billable_per_month: number | null; min_debt: number; min_creditors: number; calendar_url: string | null;
  meta_form_ids: string[]; google_form_ids: string[]; started_at: string; notes: string | null;
};

export function ClientForm({ action, c, submit }: { action: (fd: FormData) => void; c?: Partial<ClientData>; submit: string }) {
  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><Field label="Nombre del despacho *"><input name="name" required defaultValue={c?.name} className={input} /></Field></div>
        <Field label="Estado">
          <select name="status" defaultValue={c?.status ?? "activo"} className={input}>
            <option value="activo">Activo</option><option value="pausado">Pausado (no entra en cola)</option><option value="baja">Baja</option>
          </select>
        </Field>
        <Field label="Persona de contacto"><input name="contact_name" defaultValue={c?.contact_name ?? ""} className={input} /></Field>
        <Field label="Teléfono"><input name="contact_phone" defaultValue={c?.contact_phone ?? ""} className={input} /></Field>
        <Field label="Email de contacto"><input name="contact_email" type="email" defaultValue={c?.contact_email ?? ""} className={input} /></Field>
        <Field label="Email para avisos de citas" hint="Donde n8n manda cada consulta agendada"><input name="notify_email" type="email" defaultValue={c?.notify_email ?? ""} className={input} /></Field>
        <Field label="Ciudad"><input name="city" defaultValue={c?.city ?? ""} className={input} /></Field>
        <Field label="Provincias que atiende" hint="Separadas por comas. Vacío = toda España"><input name="provinces" defaultValue={c?.provinces?.join(", ") ?? ""} className={input} /></Field>
      </div>

      <div>
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
          <Field label="Fijo mensual (€)"><input name="monthly_fee" type="number" step="0.01" defaultValue={c?.monthly_fee ?? 500} className={input} /></Field>
          <Field label="Por consulta realizada (€)" hint="Recomendado 30-50 €"><input name="price_per_consultation" type="number" step="0.01" defaultValue={c?.price_per_consultation ?? 40} className={input} /></Field>
          <Field label="Tope de consultas/mes" hint="Opcional"><input name="max_billable_per_month" type="number" defaultValue={c?.max_billable_per_month ?? ""} className={input} /></Field>
          <Field label="Inicio del servicio"><input name="started_at" type="date" defaultValue={c?.started_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} className={input} /></Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Se factura como servicio de marketing (cuota fija + consultas cualificadas realizadas), nunca como porcentaje de los honorarios del despacho, por el código deontológico de la abogacía.
        </p>
      </div>

      <div>
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
        </div>
      </div>

      <Field label="Notas"><textarea name="notes" rows={3} defaultValue={c?.notes ?? ""} className={input} /></Field>
      <button className={btn.primary}>{submit}</button>
    </form>
  );
}
