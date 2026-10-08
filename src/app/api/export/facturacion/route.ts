import { getUser } from "@/lib/auth";
import { billingForMonth } from "@/lib/services/billing";
import { currentMonth } from "@/lib/format";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("No autorizado", { status: 401 });
  const month = new URL(req.url).searchParams.get("mes") ?? currentMonth();
  const rows = await billingForMonth(month);
  return csvResponse(
    toCsv(rows.map((r) => ({
      mes: month, cliente: r.cliente, linea: r.vertical, cuota_fija: r.importe_fijo, consultas_realizadas: r.citas_asistidas,
      consultas_facturables: r.consultas_facturables, precio_consulta: r.price_per_consultation,
      leads_aceptados: r.leads_aceptados, ventas: r.ventas, importe_obras: r.importe_obras,
      por_leads: r.por_leads, por_ventas: r.por_ventas, por_comision_obra: r.por_comision, importe_variable: r.importe_variable,
      total_sin_iva: r.total, iva_21: +(r.total * 0.21).toFixed(2), total_con_iva: +(r.total * 1.21).toFixed(2),
    }))),
    `facturacion-${month}.csv`,
  );
}
