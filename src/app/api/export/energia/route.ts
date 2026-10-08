import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("No autorizado", { status: 401 });
  const linea = new URL(req.url).searchParams.get("linea");
  const rows = await query(
    `SELECT created_at AS entrada, vertical AS linea, full_name AS nombre, phone AS telefono, email, province AS provincia,
            monthly_bill AS factura_mes, property_type AS vivienda, owner AS propietario, customer_type AS tipo, supplier AS compania,
            priority AS prioridad, status AS estado, attempts AS intentos, first_contact_at AS primer_contacto, converted_at AS contratado,
            commission AS comision, lost_reason AS motivo_descarte, channel AS canal, campaign AS campana
       FROM energy_leads WHERE ($1::text IS NULL OR vertical = $1) ORDER BY created_at DESC`,
    [linea === "luz" || linea === "placas" ? linea : null],
  );
  return csvResponse(toCsv(rows), `leads-${linea ?? "luz-placas"}.csv`);
}
