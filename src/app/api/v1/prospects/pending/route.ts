// GET /api/v1/prospects/pending?limit=25 — prospectos aún sin enriquecer (web + anuncios de Meta)
import { NextResponse } from "next/server";
import { apiKeyFrom, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 25), 200);
  const rows = await query(
    `SELECT id, name, website, instagram, facebook, city FROM prospects
      WHERE enriched_at IS NULL AND status NOT IN ('descartado','cliente')
      ORDER BY score DESC, created_at LIMIT $1`,
    [limit],
  );
  return NextResponse.json({ ok: true, prospects: rows });
}
