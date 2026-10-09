// Evolución del cliente: últimos 6 meses con barras y la diferencia frente al mes anterior.
import { eur } from "@/lib/format";
import type { EvolutionRow } from "@/lib/services/clientOps";

export function ClientEvolution({ rows, labels }: { rows: EvolutionRow[]; labels: { contactados: string; showups: string; ventas: string } }) {
  const cols: { key: keyof EvolutionRow; label: string; money?: boolean; pct?: boolean }[] = [
    { key: "leads", label: "Leads" },
    { key: "contactados", label: labels.contactados },
    { key: "showups", label: labels.showups },
    { key: "ventas", label: labels.ventas },
    { key: "conversion", label: "Conversión", pct: true },
    { key: "facturacion", label: "Facturación", money: true },
    { key: "auditoria", label: "Auditoría", pct: true },
  ];
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const fmt = (c: (typeof cols)[number], v: number | null | string) => (v == null ? "—" : c.money ? eur(Number(v)) : c.pct ? `${v} %` : String(v));

  return (
    <section className="rounded-[var(--radius-card)] border border-slate-200 bg-white">
      <header className="px-4 pt-4 sm:px-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Evolución · últimos {rows.length} meses</h2>
      </header>
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:p-5">
        {cols.filter((c) => ["leads", "showups", "ventas", "facturacion"].includes(c.key)).map((c) => {
          const v = last?.[c.key] as number | null;
          const p = prev?.[c.key] as number | null;
          const d = v != null && p != null ? v - p : null;
          const series = rows.map((r) => Number(r[c.key] ?? 0));
          const max = Math.max(1, ...series);
          return (
            <div key={c.key} className="rounded-2xl border border-slate-200 p-3">
              <div className="text-[11px] text-slate-500">{c.label}</div>
              <div className="num text-lg font-semibold">{fmt(c, v)}</div>
              <div className={`text-[11px] ${d == null || d === 0 ? "text-slate-400" : d > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {d == null ? "sin mes anterior" : d === 0 ? "igual que el mes pasado" : `${d > 0 ? "▲" : "▼"} ${c.money ? eur(Math.abs(d)) : Math.abs(d)}${c.pct ? " pts" : ""} vs mes pasado`}
              </div>
              <div className="mt-2 flex h-8 items-end gap-0.5">
                {series.map((x, i) => <div key={i} className={`flex-1 rounded-sm ${i === series.length - 1 ? "bg-blaze" : "bg-slate-200"}`} style={{ height: `${Math.max(4, (100 * x) / max)}%` }} />)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2 sm:px-5">Mes</th>{cols.map((c) => <th key={c.key} className="px-2 py-2 text-right">{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...rows].reverse().map((r) => (
              <tr key={r.month}>
                <td className="whitespace-nowrap px-4 py-2 font-medium sm:px-5">{r.month}</td>
                {cols.map((c) => <td key={c.key} className="num px-2 py-2 text-right">{fmt(c, r[c.key] as number | null)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
