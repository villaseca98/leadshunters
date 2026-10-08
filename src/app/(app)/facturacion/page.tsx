import { despachoBilling, lineClientBilling } from "@/lib/services/clientMetrics";
import { currentMonth, eur, monthLabel, shiftMonth } from "@/lib/format";
import { A, Badge, Card, Empty, PageHeader, Stat, Table, Td, btn } from "@/components/ui";
import { VERTICALS, isEnergy } from "@/lib/energy";

export default async function Facturacion(props: PageProps<"/facturacion">) {
  const sp = await props.searchParams;
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentMonth();
  const [all, lineRows] = await Promise.all([despachoBilling(month), lineClientBilling(month)]);
  const rows = all.filter((r) => !isEnergy(r.vertical));
  const energy = all.filter((r) => isEnergy(r.vertical));
  const tot = all.reduce(
    (a, r) => ({ ...a, fijo: a.fijo + r.importe_fijo, variable: a.variable + r.importe_variable, marcadores: a.marcadores + r.marcadores, total: a.total + r.total_con_marcadores, consultas: a.consultas + r.consultas_facturables, pendientes: a.pendientes + r.citas_pendientes }),
    { fijo: 0, variable: 0, marcadores: 0, total: 0, consultas: 0, pendientes: 0, lineas: 0 },
  );
  for (const r of lineRows) { tot.fijo += r.importe_fijo; tot.variable += r.importe_showups + r.importe_ventas; tot.marcadores += r.marcadores; tot.total += r.total; tot.lineas += r.total; }
  return (
    <>
      <PageHeader
        title={monthLabel(month).replace(/^./, (c) => c.toUpperCase())}
        eyebrow="Facturación"
        subtitle="Todos tus clientes: despachos, luz, placas y demás líneas. Importes sin IVA."
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
        <Stat label="Variable" value={eur(tot.variable)} hint={`${tot.consultas} consultas, contratos, leads aceptados, show-ups y ventas`} />
        <Stat label="Marcadores" value={eur(tot.marcadores)} hint={tot.pendientes ? `${tot.pendientes} consultas sin confirmar` : "Importes añadidos a mano"} tone={tot.pendientes ? "bad" : undefined} />
      </div>
      {energy.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Luz y placas</h2>
          <Table head={["Cliente", "Línea", "Leads", "Oportunidades", "Leads aceptados", "Rechazados", "Ventas", "Por leads", "Por ventas", "% obra", "Marcadores", "Total"]}>
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
                <Td hide>{eur(r.marcadores)}</Td>
                <Td className="num text-base font-semibold">{eur(r.total_con_marcadores)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      {energy.length > 0 && rows.length > 0 && <h2 className="mb-2 text-sm font-semibold text-slate-800">Despachos</h2>}
      {rows.length === 0 && energy.length === 0 ? <Empty>No hay clientes con actividad este mes.</Empty> : rows.length === 0 ? null : (
        <Table head={["Despacho", "Leads", "Cualificados", "Agendadas", "Realizadas", "No asistió", "Sin confirmar", "Fijo", "Consultas", "Marcadores", "Total", ""]}>
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
              <Td hide>{eur(r.marcadores)}</Td>
              <Td className="num text-base font-semibold">{eur(r.total_con_marcadores)}</Td>
              <Td><a className="text-xs font-semibold text-indigo-700" href={`/api/export/informe?cliente=${r.client_id}&mes=${month}`}>Justificante</a></Td>
            </tr>
          ))}
        </Table>
      )}
      {lineRows.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Otras líneas · {eur(tot.lineas)}</h2>
          <Table head={["Cliente", "Línea", "Leads", "Show-ups", "Ventas", "Fijo", "Show-ups €", "Ventas €", "Marcadores", "Total"]}>
            {lineRows.map((r) => (
              <tr key={r.client_id}>
                <Td primary><A href={`/clientes/l/${r.client_id}?mes=${month}`}>{r.cliente}</A></Td>
                <Td>{r.line_emoji} {r.line_name}</Td>
                <Td>{r.leads}</Td>
                <Td className="font-medium text-emerald-700">{r.showups}</Td>
                <Td>{r.ventas}</Td>
                <Td hide>{eur(r.importe_fijo)}</Td>
                <Td hide>{r.showups} × {eur(r.price_per_showup)} = {eur(r.importe_showups)}</Td>
                <Td>{eur(r.importe_ventas)}</Td>
                <Td hide>{eur(r.marcadores)}</Td>
                <Td className="num text-base font-semibold">{eur(r.total)}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}
      <Card className="mt-6" title="Cómo se factura">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Cada despacho paga la <b>cuota fija de su plan</b>: Esencial 400 €, Completo 750 € o Premium 1.100 € al mes. La inversión en anuncios la paga aparte, directamente a Meta y Google.</li>
          <li>Además paga <b>por cada consulta cualificada que se realiza</b> (40, 35 o 30 € según el plan). Las que no se presentan o se cancelan no se cobran, y tampoco las de leads que llamamos más tarde de 5 minutos en horario de atención (garantía).</li>
          <li>Es un <b>servicio de marketing</b>: nunca se factura un porcentaje de los honorarios del despacho (código deontológico de la abogacía).</li>
          <li><b>Luz</b>: se cobra la comisión de cada contrato que queda <b>activado</b> (no al firmar: la comercializadora paga cuando el suministro empieza).</li>
          <li><b>Placas</b>: el instalador paga cada lead que <b>acepta</b> (si no lo rechaza en su plazo, cuenta como aceptado) y además un % de cada obra firmada. Los rechazados no se cobran.</li>
          <li>Los <b>clientes de otras líneas</b> (luz, placas…) tienen su propio fijo, precio por show-up y precio por venta; si el lead lleva su comisión, se usa esa.</li>
          <li>Los <b>marcadores</b> en euros que marques como facturables se suman al total del cliente ese mes.</li>
          <li>El justificante CSV lista cada consulta con fecha, deuda y quién confirmó la asistencia (equipo o despacho).</li>
        </ul>
      </Card>
    </>
  );
}
