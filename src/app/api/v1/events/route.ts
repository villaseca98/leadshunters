// GET /api/v1/events?limit=50 — eventos pendientes de entregar (por si el webhook de n8n estaba caído)
import { NextResponse } from "next/server";
import { apiKeyFrom, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  if (!isMasterKey(apiKeyFrom(req))) return unauthorized();
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 50), 500);
  const rows = await query("SELECT id, kind, payload, created_at FROM events WHERE delivered_at IS NULL ORDER BY id LIMIT $1", [limit]);
  return NextResponse.json({ ok: true, events: rows });
}
