import { getUser } from "@/lib/auth";
import { despachoBilling, lineClientBilling } from "@/lib/services/clientMetrics";
import { currentMonth } from "@/lib/format";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("No autorizado", { status: 401 });
  const month = new URL(req.url).searchParams.get("mes") ?? currentMonth();
  const [rows, lineRows] = await Promise.all([despachoBilling(month), lineClientBilling(month)]);
  const iva = (t: number) => ({ total_sin_iva: t, iva_21: +(t * 0.21).toFixed(2), total_con_iva: +(t * 1.21).toFixed(2) });
  return csvResponse(
    toCsv([
      ...rows.map((r) => ({
        mes: month, linea: "despachos", cliente: r.cliente, cuota_fija: r.importe_fijo, show_ups: r.citas_asistidas,
        show_ups_facturables: r.consultas_facturables, precio_show_up: r.price_per_consultation, importe_show_ups: r.importe_variable,
        ventas: "", importe_ventas: 0, marcadores: r.marcadores, ...iva(r.total_con_marcadores),
      })),
      ...lineRows.map((r) => ({
        mes: month, linea: r.line_slug, cliente: r.cliente, cuota_fija: r.importe_fijo, show_ups: r.showups,
        show_ups_facturables: r.showups, precio_show_up: r.price_per_showup, importe_show_ups: r.importe_showups,
        ventas: r.ventas, importe_ventas: r.importe_ventas, marcadores: r.marcadores, ...iva(r.total),
      })),
    ]),
    `facturacion-${month}.csv`,
  );
}
