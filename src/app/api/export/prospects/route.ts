import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET() {
  if (!(await getUser())) return new Response("No autorizado", { status: 401 });
  const rows = await query(
    `SELECT name AS despacho, score AS puntuacion, score_tier AS prioridad, status AS estado, phone AS telefono, email, website AS web,
            city AS ciudad, province AS provincia, rating AS valoracion, reviews_count AS resenas, instagram, facebook, linkedin,
            meta_ads_active AS anuncia_meta, website_mentions_lso AS web_menciona_lso, call_hooks AS ganchos, notes AS notas, created_at AS alta
       FROM prospects ORDER BY score DESC`,
  );
  return csvResponse(toCsv(rows), "despachos.csv");
}
