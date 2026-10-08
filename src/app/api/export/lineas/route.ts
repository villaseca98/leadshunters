import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("No autorizado", { status: 401 });
  const linea = new URL(req.url).searchParams.get("linea") || null;
  const rows = await query<Record<string, unknown> & { data: Record<string, string> }>(
    `SELECT ll.created_at AS entrada, c.name AS empresa, bl.slug AS linea, ll.full_name AS nombre, ll.phone AS telefono, ll.email,
            ll.province AS provincia, ll.priority AS prioridad, ll.status AS estado, ll.attempts AS intentos, ll.first_contact_at AS primer_contacto,
            ll.won_at AS cerrado, ll.value AS importe, ll.lost_reason AS motivo_descarte, ll.channel AS canal, ll.campaign AS campana, ll.data
       FROM line_leads ll JOIN business_lines bl ON bl.id = ll.line_id JOIN companies c ON c.id = bl.company_id
      WHERE ($1::text IS NULL OR bl.slug = $1) ORDER BY ll.created_at DESC`,
    [linea],
  );
  // cada respuesta de la línea en su propia columna
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.data ?? {}))));
  const flat = rows.map(({ data, ...r }) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, data?.[k] ?? ""])) }));
  return csvResponse(toCsv(flat), `leads-${linea ?? "lineas"}.csv`);
}
