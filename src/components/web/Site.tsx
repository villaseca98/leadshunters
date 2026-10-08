// Cabecera, pie y piezas comunes de la web para particulares (marca de consumo, p. ej. Mi Cuenta Nueva).
// Toda la web es informativa: el caso concreto lo estudia un despacho colaborador y lo decide el juez.
import Link from "next/link";
import type { Contact } from "@/lib/settings";

export const TEST_HREF = "/test";

const NAV = [
  { href: "/requisitos", label: "Requisitos" },
  { href: "/deudas", label: "Qué deudas" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/preguntas", label: "Preguntas" },
];

export function Logo({ brand }: { brand: string }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-sage text-sm font-bold text-white">
        {brand.slice(0, 1)}
      </span>
      {brand}
    </Link>
  );
}

export function SiteHeader({ brand }: { brand: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-paper/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Logo brand={brand} />
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>
          ))}
        </nav>
        <CtaButton small />
      </div>
      <nav className="lh-rail flex gap-4 overflow-x-auto px-4 pb-2.5 text-sm text-slate-600 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0">{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}

export function CtaButton({ small, children }: { small?: boolean; children?: React.ReactNode }) {
  return (
    <Link
      href={TEST_HREF}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-blaze font-semibold text-blaze-ink transition hover:brightness-95 ${small ? "min-h-10 px-4 text-sm" : "min-h-14 px-7 text-base"}`}
    >
      {children ?? (small ? "Hacer el test" : "Hacer el test gratuito")}
    </Link>
  );
}

export function SiteFooter({ c }: { c: Contact }) {
  const holder = c.legal || c.name;
  return (
    <footer className="mt-16 border-t border-black/5 bg-white/60">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 text-sm text-slate-600 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <Logo brand={c.brand} />
          <p className="max-w-prose leading-relaxed">
            {c.brand} es un servicio de {holder}. <strong className="font-semibold text-slate-700">No somos un despacho de abogados</strong>: ponemos en
            contacto a quien lo pide con un despacho de abogados colegiados colaborador, que es quien estudia cada caso.
          </p>
          <p className="max-w-prose text-xs leading-relaxed text-slate-500">
            La información de esta web es general y no es asesoramiento jurídico. Cancelar deudas con la Ley de Segunda Oportunidad depende de cumplir
            los requisitos legales y de la decisión del juez. Normativa: Texto Refundido de la Ley Concursal (Real Decreto Legislativo 1/2020), reformado
            por la Ley 16/2022.
          </p>
        </div>
        <nav className="grid content-start gap-2">
          <Link href="/aviso-legal" className="hover:text-ink">Aviso legal</Link>
          <Link href="/privacidad" className="hover:text-ink">Política de privacidad</Link>
          <Link href="/cookies" className="hover:text-ink">Política de cookies</Link>
          {c.email && <a href={`mailto:${c.email}`} className="hover:text-ink">{c.email}</a>}
        </nav>
      </div>
    </footer>
  );
}

export function PageTitle({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">{eyebrow}</div>}
      <h1 className="font-display mt-2 text-3xl font-semibold leading-tight md:text-4xl">{title}</h1>
      {intro && <div className="mt-3 text-[17px] leading-relaxed text-slate-600">{intro}</div>}
    </div>
  );
}

export function Card({ children, tone = "white", className = "" }: { children: React.ReactNode; tone?: "white" | "sage" | "warn"; className?: string }) {
  const t = tone === "sage" ? "bg-sage-soft ring-sage/15" : tone === "warn" ? "bg-amber-50 ring-amber-200" : "bg-white ring-black/5";
  return <div className={`rounded-[1.5rem] p-5 ring-1 md:p-6 ${t} ${className}`}>{children}</div>;
}

export function Checklist({ items, kind = "yes" }: { items: React.ReactNode[]; kind?: "yes" | "no" }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 leading-relaxed">
          <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${kind === "yes" ? "bg-sage text-white" : "bg-slate-700 text-white"}`}>
            {kind === "yes" ? "✓" : "✕"}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Source({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-xs leading-relaxed text-slate-500">Fuente: {children}</p>;
}

export function ClosingCta() {
  return (
    <section className="mt-14 rounded-[1.75rem] bg-sage px-6 py-10 text-white md:px-10">
      <h2 className="font-display text-2xl font-semibold leading-tight md:text-3xl">No te prometemos un resultado. Te decimos la verdad sobre tu caso.</h2>
      <p className="mt-3 max-w-xl leading-relaxed text-white/85">
        Responde unas preguntas y, si tu caso encaja, un abogado colegiado de un despacho colaborador lo revisa contigo.
      </p>
      <div className="mt-6"><CtaButton /></div>
    </section>
  );
}
