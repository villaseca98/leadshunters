export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  const keys = headers ?? (rows[0] ? Object.keys(rows[0]) : []);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // punto y coma + BOM: Excel en español lo abre bien
  return "﻿" + [keys.join(";"), ...rows.map((r) => keys.map((k) => esc(r[k])).join(";"))].join("\r\n");
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` },
  });
}
