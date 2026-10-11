import { notFound } from "next/navigation";
import { A, Badge, Card, Empty, Field, PageHeader, Stat, StatusBadge, Table, Td, btn, input } from "@/components/ui";
import { appUrl } from "@/lib/appUrl";
import { dateOnly, eur } from "@/lib/format";
import { PARTNER_KINDS, PARTNER_STATUS, partnerLink, quarterLabel, quarterOf } from "@/lib/partners";
import { brandUrl, getPartner, partnerLeads, partnerQuarters } from "@/lib/services/partners";
import { payQuarter, updatePartner } from "../actions";

export default async function PartnerPage(props: PageProps<"/partners/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const p = await getPartner(id);
  if (!p) notFound();
  const [leads, quarters] = await Promise.all([partnerLeads(p), partnerQuarters(p)]);
  const link = partnerLink(brandUrl(), p.code);
  const portal = `${appUrl() || "https://leadshunters-nrfo.vercel.app"}/partner/${p.portal_token}`;
  const ganados = leads.filter((l) => l.status === "ganado");
  const generado = quarters.reduce((a, q) => a + q.comision, 0);
  const pagado = quarters.reduce((a, q) => a + (q.pagado ?? 0), 0);
  const actual = quarterOf(new Date());
  return (
    <>
      <PageHeader
        eyebrow={<><A href="/partners">Partners</A> · {PARTNER_KINDS[p.kind]}</>}
        title={p.name}
        subtitle={<>Código <span className="font-mono">{p.code}</span> · {p.share_pct} % de tu comisión · {p.active ? `acuerdo firmado${p.signed_at ? ` el ${dateOnly(p.signed_at)}` : ""}` : "solicitud sin firmar"}</>}
      />
      {sp.nuevo && <p className="mb-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">Partner creado. Mándale su enlace y el de su panel.</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="Leads" value={leads.length} />
        <Stat label="Ganados" value={ganados.length} tone={ganados.length ? "good" : undefined} />
        <Stat label="Generado" value={eur(generado, 2)} />
        <Stat label="Pendiente" value={eur(Math.max(0, generado - pagado), 2)} hint={`${eur(pagado, 2)} pagado`} tone={generado - pagado > 0.005 ? "bad" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Sus enlaces">
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-xs text-slate-500">Para sus clientes</dt><dd className="break-all font-mono text-xs"><a className="text-indigo-700" href={link} target="_blank" rel="noopener">{link}</a></dd></div>
            <div><dt className="text-xs text-slate-500">Su panel (sin login; no lo compartas con nadie más)</dt><dd className="break-all font-mono text-xs"><a className="text-indigo-700" href={portal} target="_blank" rel="noopener">{portal}</a></dd></div>
            <div><dt className="text-xs text-slate-500">Página del programa</dt><dd className="break-all font-mono text-xs">{brandUrl()}/profesionales/</dd></div>
          </dl>
        </Card>
        <Card title="Liquidaciones por trimestre">
          {quarters.length === 0 ? <p className="text-sm text-slate-500">Aún no ha generado comisión. Se reparte lo que marques como ganado, por el trimestre en que se ganó.</p> : (
            <ul className="divide-y divide-slate-100">
              {quarters.map((q) => (
                <li key={q.periodo} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-medium">{quarterLabel(q.periodo)}</div>
                    <div className="text-xs text-slate-500">{q.ganados} ganados · {eur(q.comision, 2)} generado{q.periodo === actual ? " · trimestre en curso" : ""}</div>
                  </div>
                  {q.pagado != null ? (
                    <Badge tone="emerald">Pagado {eur(q.pagado, 2)}</Badge>
                  ) : (
                    <form action={payQuarter.bind(null, p.id, q.periodo)} className="flex items-center gap-2">
                      <input name="amount" defaultValue={q.comision.toFixed(2).replace(".", ",")} inputMode="decimal" className={`${input} w-28`} aria-label="Importe pagado" />
                      <input name="note" placeholder="N.º de su factura" className={`${input} w-36`} />
                      <button className={btn.secondary}>Marcar pagado</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Sus leads</h2>
      {leads.length === 0 ? <Empty>Todavía no ha entrado ningún lead con su código.</Empty> : (
        <Table head={["Fecha", "Lead", "Línea", "Estado", "Tu comisión", "Su parte"]}>
          {leads.map((l) => (
            <tr key={l.id}>
              <Td>{dateOnly(l.created_at)}</Td>
              <Td primary><A href={`/lineas/${l.id}`}>{l.full_name}</A>{l.negocio && <div className="text-xs font-normal text-slate-500">{l.negocio}</div>}</Td>
              <Td hide>{l.line_emoji} {l.line_name}</Td>
              <Td><StatusBadge map={PARTNER_STATUS} value={l.status} /></Td>
              <Td hide>{l.status === "ganado" ? eur(l.value, 2) : "—"}</Td>
              <Td className="num font-semibold">{l.comision ? eur(l.comision, 2) : "—"}</Td>
            </tr>
          ))}
        </Table>
      )}

      <Card className="mt-6" title="Datos y acuerdo">
        <form action={updatePartner.bind(null, p.id)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nombre"><input name="name" defaultValue={p.name} className={input} /></Field>
          <Field label="Tipo">
            <select name="kind" defaultValue={p.kind} className={input}>
              {Object.entries(PARTNER_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Su parte (%)"><input name="share_pct" defaultValue={String(p.share_pct).replace(".", ",")} inputMode="decimal" className={input} /></Field>
          <Field label="Contacto"><input name="contact_name" defaultValue={p.contact_name ?? ""} className={input} /></Field>
          <Field label="Teléfono"><input name="phone" defaultValue={p.phone ?? ""} className={input} /></Field>
          <Field label="Email"><input name="email" defaultValue={p.email ?? ""} className={input} /></Field>
          <Field label="NIF"><input name="nif" defaultValue={p.nif ?? ""} className={input} /></Field>
          <Field label="Firmado el"><input name="signed_at" type="date" defaultValue={p.signed_at ?? ""} className={input} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Acuerdo firmado (activo)</label>
          <div className="sm:col-span-2 lg:col-span-3"><Field label="Notas"><textarea name="notes" defaultValue={p.notes ?? ""} rows={3} className={input} /></Field></div>
          <div><button className={btn.primary}>Guardar</button></div>
        </form>
      </Card>
    </>
  );
}
