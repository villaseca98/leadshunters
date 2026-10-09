import Link from "next/link";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Tone } from "@/lib/labels";

export const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
  fuchsia: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  rose: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string }) {
  const m = map[value] ?? { label: value, tone: "slate" as Tone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

/** Puntuación 0-100 como anillo: naranja (A), ámbar (B), gris (C). */
export function ScorePill({ score, tier, size = "md" }: { score: number; tier?: string; size?: "md" | "lg" }) {
  const t = tier ?? (score >= 70 ? "A" : score >= 45 ? "B" : "C");
  const color = t === "A" ? "var(--color-blaze)" : t === "B" ? "#e8a317" : "var(--color-slate-400)";
  const box = size === "lg" ? "size-16 text-lg" : "size-11 text-[13px]";
  return (
    <span
      className={`lh-ring inline-grid shrink-0 place-items-center rounded-full ${box}`}
      style={{ ["--p" as string]: score, ["--c" as string]: color }}
      title={`Prioridad ${t} · ${score} puntos`}
    >
      <span className="grid size-[calc(100%-7px)] place-items-center rounded-full bg-white">
        <span className="num font-semibold leading-none text-ink">{score}</span>
      </span>
    </span>
  );
}

export function Card({ title, actions, children, className = "", flush = false }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h2>
          {actions}
        </header>
      )}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="flex min-w-[9.5rem] flex-col justify-between gap-3 rounded-[var(--radius-card)] border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
      <div>
        <div className={`num text-[1.75rem] font-semibold leading-none ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-indigo-600" : "text-ink"}`}>{value}</div>
        {hint && <div className="mt-1.5 text-xs leading-snug text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-7">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">{eyebrow}</div>}
        <h1 className="font-display text-[1.6rem] font-semibold leading-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-[var(--radius-card)] border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100";
export const btn = {
  base,
  primary: `${base} bg-ink text-white hover:bg-slate-800`,
  hunt: `${base} bg-blaze text-blaze-ink hover:bg-indigo-400`,
  secondary: `${base} bg-white text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50`,
  danger: `${base} bg-rose-600 text-white hover:bg-rose-500`,
  success: `${base} bg-emerald-600 text-white hover:bg-emerald-500`,
  ghost: `${base} px-3 text-slate-600 hover:bg-slate-200/60`,
};

export const input =
  "block min-h-11 w-full rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[15px] text-ink ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm";

export const label = "mb-1.5 block text-xs font-medium text-slate-600";

export function Field({ label: l, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className={label}>{l}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

type TdProps = { children?: ReactNode; className?: string; primary?: boolean; wide?: boolean; hide?: boolean; "data-label"?: string };

/** Tabla en ordenador; en móvil cada fila se convierte en tarjeta con etiquetas (ver .lh-table en globals.css). */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  const labelled = Children.map(children, (row) => {
    if (!isValidElement(row)) return row;
    const r = row as ReactElement<{ children?: ReactNode }>;
    let i = 0;
    const cells = Children.map(r.props.children, (cell) => {
      if (!isValidElement(cell)) return cell;
      const h = head[i++];
      return cloneElement(cell as ReactElement<TdProps>, { "data-label": typeof h === "string" ? h : undefined });
    });
    return cloneElement(r, {}, cells);
  });
  return (
    <div className="lh-table overflow-x-auto rounded-[var(--radius-card)] border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{labelled}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "", primary, wide, hide, ...rest }: TdProps) {
  return (
    <td
      data-label={rest["data-label"]}
      data-primary={primary ? "" : undefined}
      data-wide={wide ? "" : undefined}
      className={`whitespace-nowrap px-4 py-3 align-middle text-slate-700 ${hide ? "max-md:!hidden" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

export function A({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`font-semibold text-ink underline decoration-indigo-400 decoration-2 underline-offset-4 hover:decoration-indigo-600 ${className}`}>
      {children}
    </Link>
  );
}

export function Pager({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>
        Página {page} de {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && <Link className={btn.secondary} href={makeHref(page - 1)}>← Anterior</Link>}
        {page < pages && <Link className={btn.secondary} href={makeHref(page + 1)}>Siguiente →</Link>}
      </div>
    </div>
  );
}

/** Fila de chips de filtro deslizable en móvil. */
export function ChipLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ${
        active ? "bg-ink text-white" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
  );
}

export { Filters } from "./Filters";
