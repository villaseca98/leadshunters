// GET /api/v1/consultations/unconfirmed — consultas ya pasadas que siguen "agendadas":
// n8n manda al despacho el enlace para confirmar si se realizaron (sin confirmar no se facturan).
import { NextResponse } from "next/server";
import { apiKeyFrom, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { query } from "@/lib/db";
import { appUrl } from "@/lib/appUrl";

export async function GET(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const base = appUrl();
  const rows = await query<{ confirm_token: string }>(
    `SELECT co.id, co.scheduled_at, co.confirm_token, l.full_name AS lead_nombre, c.id AS client_id, c.name AS cliente,
            coalesce(c.notify_email, c.contact_email) AS cliente_email
       FROM consultations co JOIN leads l ON l.id = co.lead_id JOIN clients c ON c.id = co.client_id
      WHERE co.status = 'agendada' AND co.scheduled_at < now() - interval '1 hour' AND co.scheduled_at > now() - interval '30 days'
      ORDER BY c.name, co.scheduled_at`,
  );
  return NextResponse.json({
    ok: true,
    consultations: rows.map(({ confirm_token, ...r }) => ({ ...r, enlace_confirmar: base ? `${base}/confirmar/${confirm_token}` : null })),
  });
}
