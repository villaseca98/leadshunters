// GET /api/v1/consultations/reminders?hours=24 — citas próximas sin recordatorio enviado (n8n manda SMS/WhatsApp/email)
import { NextResponse } from "next/server";
import { apiKeyFrom, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  if (!isMasterKey(apiKeyFrom(req))) return unauthorized();
  const hours = Math.min(Number(new URL(req.url).searchParams.get("hours") ?? 24), 168);
  const rows = await query(
    `SELECT co.id, co.scheduled_at, co.mode, l.full_name AS lead_nombre, l.phone AS lead_telefono, l.email AS lead_email,
            c.name AS cliente, c.contact_phone AS cliente_telefono
       FROM consultations co JOIN leads l ON l.id = co.lead_id JOIN clients c ON c.id = co.client_id
      WHERE co.status = 'agendada' AND co.reminder_sent_at IS NULL
        AND co.scheduled_at > now() AND co.scheduled_at <= now() + make_interval(hours => $1)
      ORDER BY co.scheduled_at`,
    [hours],
  );
  return NextResponse.json({ ok: true, consultations: rows });
}
