import "server-only";
// El grupo: Leads Hunters (matriz) y las empresas que cuelgan de ella, con las cifras del mes de cada una.
import { query } from "../db";
import { despachoBilling, lineClientBilling } from "./clientMetrics";

export type Company = {
  id: string; slug: string; name: string; emoji: string; tagline: string | null; website: string | null; notes: string | null;
  active: boolean; is_parent: boolean; parent_id: string | null; position: number;
};

export type CompanyStats = Company & {
  lines: { id: string; slug: string; name: string; emoji: string; kind: string }[];
  leads_mes: number;
  clientes: number;
  facturacion_mes: number;
};

export async function getCompanies(): Promise<Company[]> {
  return query<Company>(
    "SELECT id, slug, name, emoji, tagline, website, notes, active, is_parent, parent_id, position FROM companies ORDER BY is_parent DESC, position, name",
  );
}

/** La matriz y sus empresas con leads, clientes activos y facturación del mes (de todas sus líneas). */
export async function groupOverview(month: string): Promise<{ parent: CompanyStats | null; companies: CompanyStats[]; total: { leads_mes: number; clientes: number; facturacion_mes: number } }> {
  const start = `${month}-01`;
  const [companies, lines, despachos, lineBills] = await Promise.all([
    getCompanies(),
    query<{ id: string; company_id: string; slug: string; name: string; emoji: string; kind: string; leads_mes: number; clientes: number }>(
      `SELECT bl.id, bl.company_id, bl.slug, bl.name, bl.emoji, bl.kind,
         CASE WHEN bl.kind = 'despachos' THEN (SELECT count(*) FROM leads WHERE vertical = 'lso' AND status <> 'duplicado' AND created_at >= $1::date)
              ELSE (SELECT count(*) FROM line_leads WHERE line_id = bl.id AND created_at >= $1::date)
                 + (SELECT count(*) FROM leads WHERE vertical = bl.slug AND status <> 'duplicado' AND created_at >= $1::date) END::int leads_mes,
         CASE WHEN bl.kind = 'despachos' THEN (SELECT count(*) FROM clients WHERE vertical = 'lso' AND status = 'activo')
              ELSE (SELECT count(*) FROM line_clients WHERE line_id = bl.id AND status = 'activo')
                 + (SELECT count(*) FROM clients WHERE vertical = bl.slug AND status = 'activo') END::int clientes
         FROM business_lines bl WHERE bl.active ORDER BY bl.position, bl.name`,
      [start],
    ),
    despachoBilling(month),
    lineClientBilling(month),
  ]);
  // facturación por línea: despachos y clientes de luz/placas por formulario web (tabla clients) + clientes de cada línea
  const billByLine = new Map<string, number>();
  for (const l of lines) {
    const vertical = l.kind === "despachos" ? "lso" : l.slug;
    const web = despachos.filter((d) => d.vertical === vertical).reduce((a, d) => a + d.total_con_marcadores, 0);
    const own = lineBills.filter((b) => b.line_id === l.id).reduce((a, b) => a + b.total, 0);
    billByLine.set(l.id, web + own);
  }
  const stats = companies.map((c) => {
    const ls = lines.filter((l) => l.company_id === c.id);
    return {
      ...c,
      lines: ls.map(({ id, slug, name, emoji, kind }) => ({ id, slug, name, emoji, kind })),
      leads_mes: ls.reduce((a, l) => a + l.leads_mes, 0),
      clientes: ls.reduce((a, l) => a + l.clientes, 0),
      facturacion_mes: ls.reduce((a, l) => a + (billByLine.get(l.id) ?? 0), 0),
    };
  });
  const parent = stats.find((c) => c.is_parent) ?? null;
  const children = stats.filter((c) => !c.is_parent);
  const sum = (k: "leads_mes" | "clientes" | "facturacion_mes") => stats.reduce((a, c) => a + c[k], 0);
  return { parent, companies: children, total: { leads_mes: sum("leads_mes"), clientes: sum("clientes"), facturacion_mes: sum("facturacion_mes") } };
}
