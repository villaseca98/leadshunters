// El grupo de un vistazo: Leads Hunters como matriz y, colgando de ella, cada empresa con sus líneas y sus cifras del mes.
import Link from "next/link";
import { eur } from "@/lib/format";
import type { CompanyStats } from "@/lib/services/group";

export function GroupOverview({ parent, companies, total, monthName }: {
  parent: CompanyStats | null;
  companies: CompanyStats[];
  total: { leads_mes: number; clientes: number; facturacion_mes: number };
  monthName: string;
}) {
  const own = parent?.lines ?? [];
  return (
    <section className="mb-5 sm:mb-6" aria-label="Grupo Leads Hunters">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
        {/* Matriz */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-ink text-2xl">{parent?.emoji ?? "🎯"}</span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blaze">Matriz</div>
              <div className="font-display text-xl font-semibold leading-tight">{parent?.name ?? "Leads Hunters"}</div>
              <div className="text-xs text-slate-500">{companies.length} empresas cuelgan de ti{own.length ? ` · ramas propias: ${own.map((l) => l.name).join(", ")}` : ""}</div>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-right sm:gap-8">
            <Kpi label={`Leads ${monthName}`} value={total.leads_mes} />
            <Kpi label="Clientes activos" value={total.clientes} />
            <Kpi label="Facturación" value={eur(total.facturacion_mes)} strong />
          </dl>
        </div>

        {/* Empresas del grupo */}
        <ol className="lh-rail flex gap-3 overflow-x-auto p-4 sm:grid sm:grid-cols-2 sm:overflow-visible sm:p-6 xl:grid-cols-3">
          {companies.map((c) => (
            <li key={c.id} className="w-[80%] min-w-0 shrink-0 sm:w-auto">
              <Link href={`/?empresa=${c.slug}`} className={`group block h-full rounded-2xl border p-4 transition hover:border-slate-400 ${c.active ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-xl">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
                    </div>
                    <div className="truncate text-xs text-slate-500">{c.tagline ?? "Empresa del grupo"}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.lines.length ? c.lines.map((l) => (
                    <span key={l.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{l.emoji} {l.name}</span>
                  )) : <span className="text-[11px] text-slate-400">Sin líneas todavía</span>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                  <Mini label="Leads" value={c.leads_mes} />
                  <Mini label="Clientes" value={c.clientes} />
                  <Mini label="Factura" value={eur(c.facturacion_mes)} />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Kpi({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={`num text-lg font-semibold sm:text-xl ${strong ? "text-emerald-700" : ""}`}>{value}</dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="num text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
