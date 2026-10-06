import "server-only";
import { query } from "../db";

export type EventKind =
  | "lead.nuevo"
  | "lead.cualificado"
  | "cita.agendada"
  | "cita.asistida"
  | "cita.no_asistio"
  | "cita.cancelada"
  | "prospecto.cliente";

/**
 * Guarda el evento (outbox) y lo envía a n8n si hay N8N_EVENTS_WEBHOOK_URL.
 * Si el envío falla queda pendiente y n8n lo puede recoger con GET /api/v1/events.
 */
export async function emitEvent(kind: EventKind, payload: Record<string, unknown>) {
  const [ev] = await query<{ id: number }>("INSERT INTO events(kind, payload) VALUES ($1, $2) RETURNING id", [kind, payload]);
  const url = process.env.N8N_EVENTS_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.N8N_API_KEY ?? "" },
      body: JSON.stringify({ id: ev.id, kind, payload, sent_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) await query("UPDATE events SET delivered_at = now() WHERE id = $1", [ev.id]);
  } catch (e) {
    console.warn(`[eventos] no se pudo enviar ${kind} a n8n:`, (e as Error).message);
  }
}
