import { A, Badge, Card, Empty, Field, PageHeader, Stat, Table, Td, btn, input } from "@/components/ui";
import { eur } from "@/lib/format";
import { PARTNER_KINDS, partnerLink } from "@/lib/partners";
import { brandUrl, listPartners } from "@/lib/services/partners";
import { addPartner } from "./actions";

export default async function Partners(props: PageProps<"/partners">) {
  const sp = await props.searchParams;
  const rows = await listPartners();
  const activos = rows.filter((r) => r.active);
  const solicitudes = rows.filter((r) => !r.active);
  const tot = rows.reduce((a, r) => ({ leads: a.leads + r.leads_90d, ganados: a.ganados + r.ganados, comision: a.comision + r.comision, pendiente: a.pendiente + r.pendiente }), { leads: 0, ganados: 0, comision: 0, pendiente: 0 });
  const base = brandUrl();
  return (
    <>
      <PageHeader
        eyebrow="Partners"
        title="Gestorías y administradores que te traen clientes"
        subtitle="Cada partner tiene su enlace con código. Sus leads se marcan solos y se lleva su % de lo que cobres por cada uno."
      />
      {typeof sp.error === "string" && <p className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{sp.error}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="Partners activos" value={activos.length} hint={solicitudes.length ? `${solicitudes.length} solicitudes sin firmar` : undefined} />
        <Stat label="Leads (90 días)" value={tot.leads} />
        <Stat label="Clientes ganados" value={tot.ganados} />
        <Stat label="Pendiente de pagar" value={eur(tot.pendiente, 2)} hint={`${eur(tot.comision, 2)} generado en total`} tone={tot.pendiente ? "bad" : undefined} />
      </div>

      {rows.length === 0 ? <Empty>Aún no hay partners. Crea el primero abajo o espera las solicitudes de la página de partners de la web.</Empty> : (
        <Table head={["Partner", "Tipo", "Código", "Leads", "Ganados", "%", "Generado", "Pendiente", "Estado"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td primary><A href={`/partners/${r.id}`}>{r.name}</A><div className="text-xs font-normal text-slate-500">{r.contact_name ?? r.email ?? r.phone ?? ""}</div></Td>
              <Td hide>{PARTNER_KINDS[r.kind]}</Td>
              <Td><span className="font-mono text-xs">{r.code}</span></Td>
              <Td>{r.leads}</Td>
              <Td className="font-medium text-emerald-700">{r.ganados}</Td>
              <Td hide>{r.share_pct} %</Td>
              <Td hide>{eur(r.comision, 2)}</Td>
              <Td className="num font-semibold">{eur(r.pendiente, 2)}</Td>
              <Td>{r.active ? <Badge tone="emerald">Activo</Badge> : <Badge tone="amber">Solicitud</Badge>}</Td>
            </tr>
          ))}
        </Table>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Nuevo partner">
          <form action={addPartner} className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del despacho"><input name="name" required className={input} placeholder="Gestoría Pérez" /></Field>
            <Field label="Tipo">
              <select name="kind" className={input} defaultValue="gestoria">
                {Object.entries(PARTNER_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Persona de contacto"><input name="contact_name" className={input} /></Field>
            <Field label="Teléfono"><input name="phone" type="tel" className={input} /></Field>
            <Field label="Email"><input name="email" type="email" className={input} /></Field>
            <Field label="NIF"><input name="nif" className={input} /></Field>
            <Field label="Su parte de tu comisión (%)"><input name="share_pct" inputMode="decimal" defaultValue="20" className={input} /></Field>
            <Field label="Código del enlace" hint="Vacío = sale del nombre. No se puede cambiar después."><input name="code" className={`${input} uppercase`} placeholder="GESTORIA-PEREZ" /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked /> Ya ha firmado el acuerdo</label>
            <div className="sm:col-span-2"><button className={btn.primary}>Crear partner</button></div>
          </form>
        </Card>
        <Card title="Cómo funciona">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>El partner da a sus clientes su enlace: <span className="font-mono text-xs">{partnerLink(base, "CODIGO")}</span>. La web guarda el código 90 días.</li>
            <li>El cliente también puede escribir el código en el formulario. El lead entra en su línea (luz o placas) marcado con el partner.</li>
            <li>Cuando marcas un lead como ganado con su comisión, el partner genera su % de esa comisión.</li>
            <li>Cada trimestre abres el partner, compruebas la liquidación y la marcas como pagada cuando te pase su factura.</li>
            <li>El partner ve en su panel sus leads (sin teléfonos ni emails), su estado y lo que lleva.</li>
            <li>Las solicitudes de la página de partners de la web llegan aquí como «Solicitud»: actívalas cuando firméis el acuerdo.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
