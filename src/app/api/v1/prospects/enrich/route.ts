// POST /api/v1/prospects/enrich — n8n manda lo que ha encontrado en la web, Instagram y la Biblioteca de anuncios de Meta.
// Body: { id, html?, instagram_followers?, instagram_days_since_post?, meta_ads_active?, meta_ads_count?, meta_ads_lso?, ...redes }
// Si se manda `html`, la app lo analiza ella misma (redes, email, formulario, WhatsApp, píxel, menciona LSO).
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { analyzeHtml, applyEnrichment, type Enrichment } from "@/lib/services/prospects";
import { queryOne } from "@/lib/db";

const s = z.string().nullish();
const b = z.boolean().nullish();
const n = z.coerce.number().int().nullish();
const Schema = z.object({
  id: z.string().uuid().optional(),
  place_id: z.string().optional(),
  html: z.string().nullish(),
  email: s, instagram: s, facebook: s, linkedin: s, tiktok: s, youtube: s,
  website_mentions_lso: b, website_has_form: b, website_has_whatsapp: b, website_has_pixel: b,
  meta_ads_active: b, meta_ads_count: n, meta_ads_lso: b,
  instagram_followers: n, instagram_days_since_post: n,
});

export async function POST(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { id: rawId, place_id, html, ...rest } = parsed.data;
  const row = rawId
    ? await queryOne<{ id: string }>("SELECT id FROM prospects WHERE id = $1", [rawId])
    : place_id
      ? await queryOne<{ id: string }>("SELECT id FROM prospects WHERE place_id = $1", [place_id])
      : null;
  if (!row) return bad("Prospecto no encontrado (manda id o place_id)", 404);
  const fromHtml = html ? analyzeHtml(html) : {};
  // lo que manda n8n explícitamente tiene prioridad sobre lo deducido del HTML
  const merged: Enrichment = { ...fromHtml };
  for (const [k, v] of Object.entries(rest)) if (v !== undefined && v !== null) (merged as Record<string, unknown>)[k] = v;
  const score = await applyEnrichment(row.id, merged);
  return NextResponse.json({ ok: true, id: row.id, score: score?.score, tier: score?.tier, hooks: score?.hooks, detected: fromHtml });
}
