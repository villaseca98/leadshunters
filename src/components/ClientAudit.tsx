"use client";
import { useOptimistic, useTransition } from "react";
import { setAudit } from "@/app/(app)/clientes/ops";

type Item = { key: string; label: string; area?: string; done: boolean; note: string | null };

/** Auditoría del mes: lista de comprobación propia de la línea del cliente, con su nota en %. */
export function ClientAudit({ kind, clientId, month, monthName, items, history }: {
  kind: "despacho" | "linea";
  clientId: string;
  month: string;
  monthName: string;
  items: Item[];
  history: { month: string; score: number | null }[];
}) {
  const [list, apply] = useOptimistic(items, (cur: Item[], a: { key: string; done: boolean }) => cur.map((i) => (i.key === a.key ? { ...i, done: a.done } : i)));
  const [, start] = useTransition();
  const score = list.length ? Math.round((100 * list.filter((i) => i.done).length) / list.length) : 0;
  const tone = score >= 80 ? "bg-emerald-600" : score >= 50 ? "bg-amber-500" : "bg-rose-500";
  if (!items.length) return null;

  return (
    <section className="rounded-[var(--radius-card)] border border-slate-200 bg-white p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Auditoría · {monthName}</h2>
        <div className="flex items-center gap-2">
          <div className="h-2 w-28 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${tone}`} style={{ width: `${score}%` }} /></div>
          <span className="num text-sm font-semibold">{score} %</span>
        </div>
      </header>
      <ul className="grid gap-2">
        {list.map((i) => (
          <li key={i.key} className={`rounded-2xl border p-3 ${i.done ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200"}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={i.done}
                onChange={(e) => {
                  const done = e.target.checked;
                  start(async () => { apply({ key: i.key, done }); await setAudit(kind, clientId, month, i.key, done); });
                }}
                className="mt-0.5 size-5 accent-emerald-600"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium">{i.label}</span>
                {i.area && <span className="text-[11px] uppercase tracking-wide text-slate-400">{i.area}</span>}
              </span>
            </label>
            <input
              defaultValue={i.note ?? ""}
              placeholder="Nota (opcional)"
              onBlur={(e) => { if (e.target.value !== (i.note ?? "")) start(() => setAudit(kind, clientId, month, i.key, i.done, e.target.value)); }}
              className="mt-2 block w-full rounded-lg border-0 bg-transparent px-8 py-1 text-xs text-slate-600 placeholder:text-slate-300 focus:bg-slate-50 focus:outline-none"
            />
          </li>
        ))}
      </ul>
      {history.some((h) => h.score != null) && (
        <div className="mt-4 flex items-end gap-1.5 border-t border-slate-100 pt-3" aria-label="Nota de auditoría de los últimos meses">
          {history.map((h) => (
            <div key={h.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end rounded bg-slate-50">
                <div className={`w-full rounded ${h.score == null ? "" : h.score >= 80 ? "bg-emerald-500" : h.score >= 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ height: `${h.score ?? 0}%` }} />
              </div>
              <span className="text-[10px] text-slate-500">{h.month.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
