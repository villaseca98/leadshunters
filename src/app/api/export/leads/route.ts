import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("No autorizado", { status: 401 });
  const u = new URL(req.url).searchParams;
  const rows = await query(
    `SELECT l.created_at AS entrada, c.name AS cliente, l.full_name AS nombre, l.phone AS telefono, l.email, l.province AS provincia,
            l.source AS origen, l.campaign AS campana, l.debt_amount AS deuda, l.creditors_count AS acreedores, l.monthly_income AS ingresos,
            l.employment_status AS situacion, l.qualification_status AS cualificacion, l.qualification_score AS puntuacion, l.status AS estado,
            l.attempts AS intentos, l.first_contact_at AS primer_contacto
       FROM leads l JOIN clients c ON c.id = l.client_id
      WHERE ($1::uuid IS NULL OR l.client_id = $1) AND ($2::text IS NULL OR l.status = $2)
      ORDER BY l.created_at DESC`,
    [u.get("cliente") || null, u.get("status") || null],
  );
  return csvResponse(toCsv(rows), "leads.csv");
}
