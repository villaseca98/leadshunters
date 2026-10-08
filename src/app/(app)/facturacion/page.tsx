import { billingForMonth } from "@/lib/services/billing";
import { currentMonth, eur, monthLabel, shiftMonth } from "@/lib/format";
import { A, Badge, Card, Empty, PageHeader, Stat, Table, Td, btn } from "@/components/ui";
import { VERTICALS, isEnergy } from "@/lib/energy";

export default async function Facturacion(props: PageProps<"/facturacion">) {
  const sp = await props.searchParams;
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentMonth();
  const all = await billingForMonth(month);
  const rows = all.filter((r) => !isEnergy(r.vertical));
  const energy = all.filter((r) => isEnergy(r.vertical));
  const totEnergy = energy.reduce((a, r) => a + r.total, 0);
  const tot = all.reduce(
    (a, r) => ({ fijo: a.fijo + r.importe_fijo, variable: a.variable + r.importe_variable, total: a.total + r.total, consultas: a.consultas + r.consultas_facturables, pendientes: a.pendientes + r.citas_pendientes }),
    { fijo: 0, variable: 0, total: 0, consultas: 0, pendientes: 0 },
  );
  return (
    <>
      <PageHeader
        title={monthLabel(month).replace(/^./, (c) => c.toUpperCase())}
        eyebrow="Facturación"
        subtitle="Despachos: cuota fija + consultas realizadas. Luz: contratos activados. Placas: leads aceptados + % de obra. Importes sin IVA."
        actions={
          <>
            <a href={`/facturacion?mes=${shiftMonth(month, -1)}`} className={btn.secondary} aria-label={monthLabel(shiftMonth(month, -1))}>← <span className="hidden sm:inline">{monthLabel(shiftMonth(month, -1))}</span></a>
            <a href={`/facturacion?mes=${shiftMonth(month, 1)}`} className={btn.secondary} aria-label={monthLabel(shiftMonth(month, 1))}><span className="hidden sm:inline">{monthLabel(shiftMonth(month, 1))}</span> →</a>
            <a href={`/api/export/facturacion?mes=${month}`} className={btn.primary}>Exportar CSV</a>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="Total del mes" value={eur(tot.total)} hint={`${eur(tot.total * 1.21)} con IVA`} tone="good" />
        <Stat label="Cuotas fijas" value={eur(tot.fijo)} />
        <Stat label="Variable" value={eur(tot.variable)} hint={`${tot.consultas} consultas · ${eur(totEnergy)} de luz y placas`} />
        <Stat label="Sin confirmar" value={tot.pendientes} hint="Consultas agendadas aún sin marcar" tone={tot.pendientes ? "bad" : undefined} />
      </div>
      {energy.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Luz y placas</h2>
          <Table head={["Cliente", "Línea", "Leads", "Oportunidades", "Leads aceptados", "Rechazados", "Ventas", "Por leads", "Por ventas", "% obra", "Total"]}>
            {energy.map((r) => (
              <tr key={r.client_id}>
                <Td primary><A href={`/clientes/${r.client_id}`}>{r.cliente}</A></Td>
                <Td><Badge tone={r.vertical === "luz" ? "amber" : "emerald"}>{VERTICALS[r.vertical as "luz"].short}</Badge></Td>
                <Td>{r.leads}</Td>
                <Td hide>{r.oportunidades}</Td>
                <Td>{r.vertical === "placas" ? r.leads_aceptados : "—"}</Td>
                <Td hide>{r.vertical === "placas" ? r.leads_rechazados : "—"}</Td>
                <Td className="font-medium text-emerald-700">{r.ventas}<div className="text-xs font-normal text-slate-500">{r.vertical === "luz" ? "contratos activados" : "obras firmadas"}</div></Td>
                <Td hide>{r.vertical === "placas" ? `${r.leads_aceptados} × ${eur(r.price_per_lead ?? 0)}` : "—"}</Td>
                <Td hide>{r.ventas} × {eur(r.price_per_sale ?? 0)}</Td>
                <Td hide>{r.vertical === "placas" ? `${r.sale_commission_pct ?? 0} % de ${eur(r.importe_obras)} = ${eur(r.por_comision)}` : "—"}</Td>
                <Td className="num text-base font-semibold">{eur(r.total)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      {energy.length > 0 && rows.length > 0 && <h2 className="mb-2 text-sm font-semibold text-slate-800">Despachos</h2>}
      {rows.length === 0 && energy.length === 0 ? <Empty>No hay clientes con actividad este mes.</Empty> : rows.length === 0 ? null : (
        <Table head={["Cliente", "Leads", "Cualificados", "Agendadas", "Realizadas", "No asistió", "Sin confirmar", "Fijo", "Consultas", "Total", ""]}>
          {rows.map((r) => (
            <tr key={r.client_id}>
              <Td primary><A href={`/clientes/${r.client_id}`}>{r.cliente}</A></Td>
              <Td>{r.leads}</Td>
              <Td hide>{r.leads_cualificados}</Td>
              <Td>{r.citas_agendadas}</Td>
              <Td className="font-medium text-emerald-700">{r.citas_asistidas}{r.max_billable_per_month != null && r.citas_asistidas > r.max_billable_per_month && <span className="text-xs text-slate-500"> (tope {r.max_billable_per_month})</span>}</Td>
              <Td hide>{r.citas_no_asistio}</Td>
              <Td className={r.citas_pendientes ? "font-medium text-amber-700" : ""}>{r.citas_pendientes}</Td>
              <Td hide>{eur(r.importe_fijo)}</Td>
              <Td wide>{r.consultas_facturables} × {eur(r.price_per_consultation)} = {eur(r.importe_variable)}{r.citas_gratis_retraso > 0 && <div className="text-xs text-slate-500">{r.citas_gratis_retraso} gratis por llamada tardía</div>}</Td>
              <Td className="num text-base font-semibold">{eur(r.total)}</Td>
              <Td><a className="text-xs font-semibold text-indigo-700" href={`/api/export/informe?cliente=${r.client_id}&mes=${month}`}>Justificante</a></Td>
            </tr>
          ))}
        </Table>
      )}
      <Card className="mt-6" title="Cómo se factura">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Cada despacho paga la <b>cuota fija de su plan</b>: Esencial 400 €, Completo 750 € o Premium 1.100 € al mes. La inversión en anuncios la paga aparte, directamente a Meta y Google.</li>
          <li>Además paga <b>por cada consulta cualificada que se realiza</b> (40, 35 o 30 € según el plan). Las que no se presentan o se cancelan no se cobran, y tampoco las de leads que llamamos más tarde de 5 minutos en horario de atención (garantía).</li>
          <li>Es un <b>servicio de marketing</b>: nunca se factura un porcentaje de los honorarios del despacho (código deontológico de la abogacía).</li>
          <li><b>Luz</b>: se cobra la comisión de cada contrato que queda <b>activado</b> (no al firmar: la comercializadora paga cuando el suministro empieza).</li>
          <li><b>Placas</b>: el instalador paga cada lead que <b>acepta</b> (si no lo rechaza en su plazo, cuenta como aceptado) y además un % de cada obra firmada. Los rechazados no se cobran.</li>
          <li>El justificante CSV lista cada consulta con fecha, deuda y quién confirmó la asistencia (equipo o despacho).</li>
        </ul>
      </Card>
    </>
  );
}
