// GET /api/v1/cola?empresa=<slug> — quién está esperando llamada en cada línea de una empresa (o de todas sin ?empresa).
// Para el resumen diario de n8n («<Empresa> · Leads por llamar»). Cabecera x-api-key.
// Las líneas de despachos cuentan la cola de leads de deudas; el resto, la cola de su línea.
import { NextResponse } from "next/server";
import { apiKeyFrom, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { appUrl } from "@/lib/appUrl";
import { query, queryOne } from "@/lib/db";

type Row = { slug: string; nombre: string; empresa: string; kind: string; n: number; a: number };

export async function GET(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const empresa = new URL(req.url).searchParams.get("empresa") || null;
  const rows = await query<Row>(
    `SELECT bl.slug, bl.emoji || ' ' || bl.name AS nombre, c.name AS empresa, bl.kind,
       CASE WHEN bl.kind = 'despachos' THEN 0 ELSE
         (SELECT count(*)::int FROM line_leads ll WHERE ll.line_id = bl.id AND ll.status IN ('nuevo','no_contesta') AND ll.next_call_at <= now()) END AS n,
       CASE WHEN bl.kind = 'despachos' THEN 0 ELSE
         (SELECT count(*)::int FROM line_leads ll WHERE ll.line_id = bl.id AND ll.status IN ('nuevo','no_contesta') AND ll.next_call_at <= now() AND ll.priority = 'A') END AS a
     FROM business_lines bl JOIN companies c ON c.id = bl.company_id
     WHERE bl.active AND c.active AND ($1::text IS NULL OR c.slug = $1)
     ORDER BY c.position, bl.position`,
    [empresa],
  );
  if (rows.some((r) => r.kind === "despachos")) {
    const d = await queryOne<{ n: number }>(
      `SELECT count(*)::int n FROM leads WHERE status IN ('nuevo','no_contesta','volver_a_llamar') AND next_call_at <= now()`,
    );
    for (const r of rows) if (r.kind === "despachos") r.n = d?.n ?? 0;
  }
  const total = rows.reduce((s, r) => s + r.n, 0);
  const base = appUrl();
  const texto = total
    ? [`📞 *${empresa ? rows[0]?.empresa ?? empresa : "Grupo"}: ${total} por llamar*`,
        ...rows.filter((r) => r.n).map((r) => `• ${r.nombre}: ${r.n}${r.a ? ` (${r.a} prioridad A)` : ""}`),
        `👉 ${base}${rows.every((r) => r.kind === "despachos") ? "/cola" : "/lineas/cola"}`].join("\n")
    : "";
  return NextResponse.json({ ok: true, empresa, total, lineas: rows.map((r) => ({ slug: r.slug, nombre: r.nombre, empresa: r.empresa, n: r.n, a: r.a })), texto });
}
