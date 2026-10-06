// POST /api/v1/consultations/:id { reminder_sent?: true, status?: "asistida"|"no_asistio"|"cancelada" }
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { query } from "@/lib/db";
import { setConsultationStatus } from "@/lib/services/leads";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/consultations/[id]">) {
  if (!isMasterKey(apiKeyFrom(req))) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { reminder_sent?: boolean; status?: string };
  if (body.reminder_sent) await query("UPDATE consultations SET reminder_sent_at = now() WHERE id = $1", [id]);
  if (body.status) {
    if (!["asistida", "no_asistio", "cancelada"].includes(body.status)) return bad("Estado no válido");
    const r = await setConsultationStatus(id, body.status as "asistida", "equipo");
    if (!r) return bad("Cita no encontrada", 404);
  }
  return NextResponse.json({ ok: true });
}
