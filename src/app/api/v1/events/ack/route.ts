// POST /api/v1/events/ack { ids: [1,2,3] } — marca eventos como entregados
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  if (!isMasterKey(apiKeyFrom(req))) return unauthorized();
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isFinite) : [];
  if (!ids.length) return bad("Faltan ids");
  await query("UPDATE events SET delivered_at = now() WHERE id = ANY($1::bigint[])", [ids]);
  return NextResponse.json({ ok: true, acked: ids.length });
}
