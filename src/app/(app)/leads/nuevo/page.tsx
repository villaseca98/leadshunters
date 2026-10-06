import { query } from "@/lib/db";
import { Card, Field, PageHeader, btn, input } from "@/components/ui";
import { createLead } from "../actions";

export default async function NuevoLead() {
  const clients = await query<{ id: string; name: string }>("SELECT id, name FROM clients WHERE status <> 'baja' ORDER BY name");
  return (
    <>
      <PageHeader title="Lead manual" subtitle="Para personas que llaman o escriben directamente. Solo con su consentimiento." />
      <Card>
        {clients.length === 0 ? (
          <p className="text-sm text-slate-600">Primero crea un cliente en la sección Clientes.</p>
        ) : (
          <form action={createLead} className="grid max-w-3xl gap-3 sm:grid-cols-2">
            <Field label="Cliente (despacho) *">
              <select name="client_id" required className={input}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Origen">
              <select name="source" className={input}><option value="manual">Manual</option><option value="web">Web</option><option value="otro">Otro</option></select>
            </Field>
            <Field label="Nombre y apellidos *"><input name="full_name" required className={input} /></Field>
            <Field label="Teléfono *"><input name="phone" required className={input} /></Field>
            <Field label="Email"><input name="email" type="email" className={input} /></Field>
            <Field label="Provincia"><input name="province" className={input} /></Field>
            <Field label="Deuda total (€)"><input name="debt_amount" className={input} /></Field>
            <Field label="Nº de acreedores"><input name="creditors_count" className={input} /></Field>
            <Field label="Ingresos mensuales (€)"><input name="monthly_income" className={input} /></Field>
            <Field label="Situación laboral">
              <select name="employment_status" className={input}>
                <option value="">—</option><option value="asalariado">Asalariado</option><option value="autonomo">Autónomo</option>
                <option value="desempleado">Desempleado</option><option value="pensionista">Pensionista</option>
              </select>
            </Field>
            <div className="sm:col-span-2"><button className={btn.primary}>Crear y cualificar</button></div>
          </form>
        )}
      </Card>
    </>
  );
}
