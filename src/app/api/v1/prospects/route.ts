// POST /api/v1/prospects — n8n envía los resultados de Apify (Google Maps). Acepta un item, un array o {items, search_term}.
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { fromApifyItem, upsertProspect } from "@/lib/services/prospects";
import { query } from "@/lib/db";

export async function POST(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("JSON no válido");
  }
  const b = body as { items?: unknown[]; search_term?: string };
  const items = Array.isArray(body) ? body : Array.isArray(b.items) ? b.items : [body];
  const out: { id: string; name: string; website: string | null; created: boolean; score: number; tier: string }[] = [];
  let skipped = 0;
  for (const raw of items) {
    const p = fromApifyItem((raw ?? {}) as Record<string, unknown>, b.search_term);
    if (!p) {
      skipped++;
      continue;
    }
    const r = await upsertProspect(p);
    const [row] = await query<{ score: number; score_tier: string }>("SELECT score, score_tier FROM prospects WHERE id = $1", [r.id]);
    out.push({ id: r.id, name: p.name, website: p.website ?? null, created: r.created, score: row.score, tier: row.score_tier });
  }
  return NextResponse.json({
    ok: true,
    created: out.filter((o) => o.created).length,
    updated: out.filter((o) => !o.created).length,
    skipped,
    prospects: out,
  });
}

// GET /api/v1/prospects?status=a_llamar&min_score=60&limit=50 — para exportar a Sheets o CRM
export async function GET(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const u = new URL(req.url).searchParams;
  const rows = await query(
    `SELECT id, name, city, province, phone, email, website, score, score_tier, status, call_hooks, created_at
       FROM prospects WHERE ($1::text IS NULL OR status = $1) AND score >= $2 ORDER BY score DESC LIMIT $3`,
    [u.get("status"), Number(u.get("min_score") ?? 0), Math.min(Number(u.get("limit") ?? 100), 1000)],
  );
  return NextResponse.json({ ok: true, prospects: rows });
}
