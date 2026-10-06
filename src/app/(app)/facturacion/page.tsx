import { billingForMonth } from "@/lib/services/billing";
import { currentMonth, eur, monthLabel, shiftMonth } from "@/lib/format";
import { A, Card, Empty, PageHeader, Stat, Table, Td, btn } from "@/components/ui";

export default async function Facturacion(props: PageProps<"/facturacion">) {
  const sp = await props.searchParams;
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentMonth();
  const rows = await billingForMonth(month);
  const tot = rows.reduce(
    (a, r) => ({ fijo: a.fijo + r.importe_fijo, variable: a.variable + r.importe_variable, total: a.total + r.total, consultas: a.consultas + r.consultas_facturables, pendientes: a.pendientes + r.citas_pendientes }),
    { fijo: 0, variable: 0, total: 0, consultas: 0, pendientes: 0 },
  );
  return (
    <>
      <PageHeader
        title={`Facturación · ${monthLabel(month)}`}
        subtitle="Cuota fija de marketing + importe por consulta cualificada realizada. Importes sin IVA."
        actions={
          <>
            <a href={`/facturacion?mes=${shiftMonth(month, -1)}`} className={btn.secondary}>← {monthLabel(shiftMonth(month, -1))}</a>
            <a href={`/facturacion?mes=${shiftMonth(month, 1)}`} className={btn.secondary}>{monthLabel(shiftMonth(month, 1))} →</a>
            <a href={`/api/export/facturacion?mes=${month}`} className={btn.primary}>Exportar CSV</a>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total del mes" value={eur(tot.total)} hint={`${eur(tot.total * 1.21)} con IVA`} tone="good" />
        <Stat label="Cuotas fijas" value={eur(tot.fijo)} />
        <Stat label="Por consultas" value={eur(tot.variable)} hint={`${tot.consultas} consultas facturables`} />
        <Stat label="Sin confirmar" value={tot.pendientes} hint="Consultas agendadas aún sin marcar" tone={tot.pendientes ? "bad" : undefined} />
      </div>
      {rows.length === 0 ? <Empty>No hay clientes con actividad este mes.</Empty> : (
        <Table head={["Cliente", "Leads", "Cualificados", "Agendadas", "Realizadas", "No asistió", "Sin confirmar", "Fijo", "Consultas", "Total", ""]}>
          {rows.map((r) => (
            <tr key={r.client_id}>
              <Td><A href={`/clientes/${r.client_id}`}>{r.cliente}</A></Td>
              <Td>{r.leads}</Td>
              <Td>{r.leads_cualificados}</Td>
              <Td>{r.citas_agendadas}</Td>
              <Td className="font-medium text-emerald-700">{r.citas_asistidas}{r.max_billable_per_month != null && r.citas_asistidas > r.max_billable_per_month && <span className="text-xs text-slate-500"> (tope {r.max_billable_per_month})</span>}</Td>
              <Td>{r.citas_no_asistio}</Td>
              <Td className={r.citas_pendientes ? "font-medium text-amber-700" : ""}>{r.citas_pendientes}</Td>
              <Td>{eur(r.importe_fijo)}</Td>
              <Td>{r.consultas_facturables} × {eur(r.price_per_consultation)} = {eur(r.importe_variable)}</Td>
              <Td className="font-semibold">{eur(r.total)}</Td>
              <Td><a className="text-xs text-indigo-600" href={`/api/export/informe?cliente=${r.client_id}&mes=${month}`}>Justificante</a></Td>
            </tr>
          ))}
        </Table>
      )}
      <Card className="mt-6" title="Cómo se factura">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Cada despacho paga una <b>cuota fija mensual</b> (500 € por defecto) por la gestión de campañas y el equipo de llamadas.</li>
          <li>Además paga <b>30-50 € por consulta cualificada que se realiza</b>. Las que no se presentan o se cancelan no se cobran.</li>
          <li>Es un <b>servicio de marketing</b>: nunca se factura un porcentaje de los honorarios del despacho (código deontológico de la abogacía).</li>
          <li>El justificante CSV lista cada consulta con fecha, deuda y quién confirmó la asistencia (equipo o despacho).</li>
        </ul>
      </Card>
    </>
  );
}
