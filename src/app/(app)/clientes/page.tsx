import Link from "next/link";
import { planName } from "@/lib/plans";
import { query } from "@/lib/db";
import { billingForMonth } from "@/lib/services/billing";
import { currentMonth, eur, monthLabel } from "@/lib/format";
import { getUser } from "@/lib/auth";
import { despachoBilling, lineClientBilling } from "@/lib/services/clientMetrics";
import { getLines } from "@/lib/services/lines";
import { A, Badge, Card, Empty, Field, PageHeader, Table, Td, btn, input } from "@/components/ui";
import { createLineClient } from "./lineActions";
import { AiCaseField, CreateButton } from "@/components/AiCaseField";

export default async function Clientes(props: PageProps<"/clientes">) {
  const sp = await props.searchParams;
  const month = currentMonth();
  const [lineBills, lines, user, despMarkers] = await Promise.all([
    lineClientBilling(month),
    getLines({ includeDespachos: false }),
    getUser(),
    despachoBilling(month),
  ]);
  const extraDesp = new Map(despMarkers.map((d) => [d.client_id, d.marcadores]));
  const clients = await query<{ id: string; name: string; city: string | null; status: string; monthly_fee: number; price_per_consultation: number; contact_name: string | null; plan: string }>(
    "SELECT id, name, city, status, monthly_fee, price_per_consultation, contact_name, plan FROM clients WHERE vertical = 'lso' ORDER BY status, name",
  );
  const bill = new Map((await billingForMonth(month)).map((b) => [b.client_id, b]));
  return (
    <>
      <PageHeader title="Clientes" eyebrow="Quién te paga, por línea" subtitle={`Métricas y facturación de ${monthLabel(month)}. Entra en cada cliente para ver el desglose y sus marcadores.`} actions={<Link href="/clientes/nuevo" className={btn.primary}>+ Nuevo despacho</Link>} />
      {typeof sp.error === "string" && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{sp.error}</p>}
      <h2 className="mb-3 font-display text-lg font-semibold">⚖️ Despachos</h2>
      {clients.length === 0 ? (
        <Empty>Aún no hay clientes. Convierte un despacho desde Prospección o créalo a mano.</Empty>
      ) : (
        <Table head={["Despacho", "Estado", "Condiciones", "Leads mes", "Cualificados", "Consultas", "Realizadas", "Facturación mes"]}>
          {clients.map((c) => {
            const b = bill.get(c.id);
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <Td primary><A href={`/clientes/${c.id}`}>{c.name}</A><div className="text-xs text-slate-500">{[c.contact_name, c.city].filter(Boolean).join(" · ")}</div></Td>
                <Td><Badge tone={c.status === "activo" ? "emerald" : c.status === "pausado" ? "amber" : "slate"}>{c.status}</Badge></Td>
                <Td className="text-xs"><span className="font-semibold">{planName(c.plan)}</span><div>{eur(c.monthly_fee)} + {eur(c.price_per_consultation)}/consulta</div></Td>
                <Td>{b?.leads ?? 0}</Td>
                <Td hide>{b?.leads_cualificados ?? 0}</Td>
                <Td hide>{b?.citas_agendadas ?? 0}</Td>
                <Td className="font-medium text-emerald-700">{b?.citas_asistidas ?? 0}</Td>
                <Td className="num text-base font-semibold">{eur((b?.total ?? 0) + (extraDesp.get(c.id) ?? 0))}</Td>
              </tr>
            );
          })}
        </Table>
      )}

      {lines.map((line) => {
        const rows = lineBills.filter((r) => r.line_id === line.id);
        // clientes de luz y placas que llegan por los formularios web de Recorta (con oportunidades)
        const web = despMarkers.filter((d) => d.vertical === line.slug);
        return (
          <section key={line.id} className="mt-8">
            <h2 className="mb-3 font-display text-lg font-semibold">{line.emoji} {line.name} <span className="text-sm font-normal text-slate-500">· {line.company_name}</span></h2>
            {web.length > 0 && (
              <div className="mb-3">
                <Table head={["Cliente (web y oportunidades)", "Estado", "Leads mes", "Oportunidades", line.slug === "placas" ? "Aceptados" : "Activados", "Marcadores", "Facturación mes"]}>
                  {web.map((r) => (
                    <tr key={r.client_id} className="hover:bg-slate-50">
                      <Td primary><A href={`/clientes/${r.client_id}`}>{r.cliente}</A></Td>
                      <Td><Badge tone={r.status === "activo" ? "emerald" : r.status === "pausado" ? "amber" : "slate"}>{r.status}</Badge></Td>
                      <Td>{r.leads}</Td>
                      <Td>{r.oportunidades}</Td>
                      <Td className="font-medium text-emerald-700">{line.slug === "placas" ? r.leads_aceptados : r.ventas}</Td>
                      <Td hide>{eur(r.marcadores)}</Td>
                      <Td className="num text-base font-semibold">{eur(r.total_con_marcadores)}</Td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}
            {rows.length === 0 && web.length > 0 ? null : rows.length === 0 ? <Empty>{line.fields.length || line.keywords.length ? `Sin clientes en ${line.name}. Convierte un lead en cliente desde su ficha o añádelo abajo.` : `Sin clientes en ${line.name}. Añádelos abajo: es la línea libre para negocios que no impulsas todavía.`}</Empty> : (
              <Table head={["Cliente", "Estado", "Condiciones", "Leads mes", "Show-ups", line.won_label, "Marcadores", "Facturación mes"]}>
                {rows.map((r) => (
                  <tr key={r.client_id} className="hover:bg-slate-50">
                    <Td primary><A href={`/clientes/l/${r.client_id}`}>{r.cliente}</A></Td>
                    <Td><Badge tone={r.status === "activo" ? "emerald" : r.status === "pausado" ? "amber" : "slate"}>{r.status}</Badge></Td>
                    <Td className="text-xs">{[r.monthly_fee ? `${eur(r.monthly_fee)} fijo` : null, r.price_per_showup ? `${eur(r.price_per_showup)}/show-up` : null, r.price_per_sale ? `${eur(r.price_per_sale)}/venta` : "importe por venta"].filter(Boolean).join(" + ")}</Td>
                    <Td>{r.leads}</Td>
                    <Td className="font-medium text-emerald-700">{r.showups}</Td>
                    <Td>{r.ventas}</Td>
                    <Td hide>{eur(r.marcadores)}</Td>
                    <Td className="num text-base font-semibold">{eur(r.total)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </section>
        );
      })}

      {user?.role === "admin" && lines.length > 0 && (
        <section id="nuevo" className="mt-8"><Card title="Nuevo cliente de otra línea">
          <form action={createLineClient} className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <div className="sm:col-span-3"><AiCaseField /></div>
            <Field label="Línea">
              <select name="line_id" required className={input}>
                {lines.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.name} · {l.company_name}</option>)}
              </select>
            </Field>
            <Field label="Nombre"><input name="name" required placeholder="Nombre del cliente" className={input} /></Field>
            <Field label="Fijo €/mes"><input name="monthly_fee" inputMode="decimal" placeholder="0" className={input} /></Field>
            <Field label="€ por show-up"><input name="price_per_showup" inputMode="decimal" placeholder="0" className={input} /></Field>
            <Field label="€ por venta"><input name="price_per_sale" inputMode="decimal" placeholder="0 = importe de cada lead" className={input} /></Field>
            <CreateButton className={btn.primary}>Crear cliente</CreateButton>
          </form>
        </Card></section>
      )}
    </>
  );
}
