// GET /api/v1/billing?month=2026-10 — resumen por cliente para el informe mensual de n8n
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { billingForMonth } from "@/lib/services/billing";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  if (!isMasterKey(apiKeyFrom(req))) return unauthorized();
  const u = new URL(req.url).searchParams;
  const month = u.get("month") ?? (() => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1); // por defecto, el mes anterior
    return d.toISOString().slice(0, 7);
  })();
  try {
    const rows = await billingForMonth(month);
    const emails = await query<{ id: string; notify_email: string | null; contact_email: string | null; contact_name: string | null }>(
      "SELECT id, notify_email, contact_email, contact_name FROM clients",
    );
    const byId = new Map(emails.map((e) => [e.id, e]));
    return NextResponse.json({
      ok: true,
      month,
      clients: rows.map((r) => ({
        ...r,
        email: byId.get(r.client_id)?.contact_email ?? byId.get(r.client_id)?.notify_email ?? null,
        contacto: byId.get(r.client_id)?.contact_name ?? null,
      })),
    });
  } catch (e) {
    return bad((e as Error).message);
  }
}
