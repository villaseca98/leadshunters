import { ENERGY_CONSENT_TEXT, PROPERTY } from "@/lib/energia";
import { Card, Field, PageHeader, btn, input } from "@/components/ui";
import { createEnergyLead } from "../actions";

export default async function NuevoEnergia(props: PageProps<"/energia/nuevo">) {
  const sp = await props.searchParams;
  const linea = sp.linea === "placas" ? "placas" : "luz";
  const error = typeof sp.error === "string" ? sp.error : "";
  return (
    <>
      <PageHeader title="Lead de luz o placas" subtitle="Para quien te escribe por Instagram o WhatsApp y te da sus datos. Solo con su permiso." />
      <Card>
        {error && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <form action={createEnergyLead} className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <Field label="Línea *">
            <select name="vertical" defaultValue={linea} className={input}><option value="luz">Luz</option><option value="placas">Placas solares</option></select>
          </Field>
          <Field label="Canal">
            <select name="channel" className={input}><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="manual">Otro</option></select>
          </Field>
          <Field label="Nombre *"><input name="full_name" required className={input} /></Field>
          <Field label="Teléfono *"><input name="phone" required className={input} /></Field>
          <Field label="Email"><input name="email" type="email" className={input} /></Field>
          <Field label="Provincia"><input name="province" className={input} /></Field>
          <Field label="Factura de la luz (€/mes)"><input name="monthly_bill" inputMode="decimal" className={input} /></Field>
          <Field label="Vivienda">
            <select name="property_type" className={input}>
              <option value="">—</option>
              {Object.entries(PROPERTY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="¿Propietario?">
            <select name="owner" className={input}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select>
          </Field>
          <Field label="Hogar o negocio">
            <select name="customer_type" className={input}><option value="hogar">Hogar</option><option value="negocio">Negocio</option></select>
          </Field>
          <Field label="Compañía actual"><input name="supplier" className={input} /></Field>
          <Field label="Campaña o reel"><input name="campaign" className={input} /></Field>
          <div className="sm:col-span-2"><Field label="Notas"><textarea name="notes" rows={2} className={input} /></Field></div>
          <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>Me ha dado permiso para llamarle: «{ENERGY_CONSENT_TEXT(linea)}»</span>
          </label>
          <div className="sm:col-span-2"><button className={btn.primary}>Crear lead</button></div>
        </form>
      </Card>
    </>
  );
}
