// Detalle de consultas de un cliente en un mes: lo que se adjunta a la factura como justificante.
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { currentMonth } from "@/lib/format";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("No autorizado", { status: 401 });
  const u = new URL(req.url).searchParams;
  const month = u.get("mes") ?? currentMonth();
  const rows = await query(
    `SELECT to_char(co.scheduled_at AT TIME ZONE 'Europe/Madrid', 'DD/MM/YYYY HH24:MI') AS fecha, l.full_name AS persona,
            l.province AS provincia, l.debt_amount AS deuda, l.creditors_count AS acreedores, co.mode AS modalidad, co.status AS estado,
            CASE WHEN co.billable THEN 'sí' ELSE 'no' END AS facturable, co.confirmed_by AS confirmado_por
       FROM consultations co JOIN leads l ON l.id = co.lead_id
      WHERE co.client_id = $1 AND to_char(co.scheduled_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') = $2
      ORDER BY co.scheduled_at`,
    [u.get("cliente"), month],
  );
  return csvResponse(toCsv(rows), `consultas-${month}.csv`);
}
