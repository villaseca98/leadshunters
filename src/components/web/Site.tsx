// Cabecera, pie y piezas comunes de la web para particulares (marca de consumo, p. ej. Mi Cuenta Nueva).
// Toda la web es informativa: el caso concreto lo estudia un despacho colaborador y lo decide el juez.
// Estilo minimalista: mucho aire, líneas finas en vez de sombras, botones en tinta y un solo verde de acento.
import Link from "next/link";
import type { Contact } from "@/lib/settings";

export const TEST_HREF = "/test";

const NAV = [
  { href: "/requisitos", label: "Requisitos" },
  { href: "/deudas", label: "Qué deudas" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/preguntas", label: "Preguntas" },
];

// Marca: un círculo que se cierra sobre sí mismo (volver a empezar) con un punto de acento.
function Mark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-6">
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="19.2" cy="5.6" r="2.2" className="fill-sage" />
    </svg>
  );
}

export function Logo({ brand }: { brand: string }) {
  return (
    <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-ink">
      <Mark />
      {brand}
    </Link>
  );
}

export function SiteHeader({ brand }: { brand: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-paper/80 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Logo brand={brand} />
        <nav className="hidden items-center gap-8 text-[14px] text-slate-500 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition hover:text-ink">{n.label}</Link>
          ))}
        </nav>
        <CtaButton small />
      </div>
      <nav className="lh-rail flex gap-5 overflow-x-auto px-5 pb-3 text-[14px] text-slate-500 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0">{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}

export function CtaButton({ small, light, children }: { small?: boolean; light?: boolean; children?: React.ReactNode }) {
  const tone = light ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-ink/85";
  return (
    <Link
      href={TEST_HREF}
      className={`group inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium transition ${tone} ${small ? "h-9 px-4 text-[14px]" : "h-13 px-6 text-[15px]"}`}
    >
      {children ?? (small ? "Hacer el test" : "Hacer el test gratuito")}
      {!small && <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>}
    </Link>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-[15px] font-medium text-ink underline decoration-black/20 underline-offset-[5px] transition hover:decoration-ink">
      {children}
    </Link>
  );
}

export function SiteFooter({ c }: { c: Contact }) {
  const holder = c.legal || c.name;
  return (
    <footer className="mt-24 border-t border-black/[0.06]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 text-[14px] text-slate-500 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo brand={c.brand} />
          <p className="max-w-md leading-relaxed">
            {c.brand} es un servicio de {holder}. <strong className="font-medium text-slate-700">No somos un despacho de abogados</strong>: ponemos en
            contacto a quien lo pide con un despacho de abogados colegiados colaborador, que es quien estudia cada caso.
          </p>
        </div>
        <nav className="grid content-start gap-2.5">
          <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">La ley</div>
          {NAV.map((n) => <Link key={n.href} href={n.href} className="hover:text-ink">{n.label}</Link>)}
        </nav>
        <nav className="grid content-start gap-2.5">
          <div className="mb-1 text-[12px] font-medium uppercase tracking-[0.12em] text-slate-400">Legal</div>
          <Link href="/aviso-legal" className="hover:text-ink">Aviso legal</Link>
          <Link href="/privacidad" className="hover:text-ink">Privacidad</Link>
          <Link href="/cookies" className="hover:text-ink">Cookies</Link>
          {c.email && <a href={`mailto:${c.email}`} className="hover:text-ink">{c.email}</a>}
        </nav>
        <p className="text-[12px] leading-relaxed text-slate-400 md:col-span-3">
          La información de esta web es general y no es asesoramiento jurídico. Cancelar deudas con la Ley de Segunda Oportunidad depende de cumplir los
          requisitos legales y de la decisión del juez. Normativa: Texto Refundido de la Ley Concursal (Real Decreto Legislativo 1/2020), reformado por la
          Ley 16/2022.
        </p>
      </div>
    </footer>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-sage">{children}</div>;
}

export function PageTitle({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: React.ReactNode }) {
  return (
    <div className="max-w-3xl pt-4 md:pt-10">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="font-display mt-4 text-[2.5rem] font-medium leading-[1.05] md:text-6xl">{title}</h1>
      {intro && <div className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-500">{intro}</div>}
    </div>
  );
}

// Encabezado de sección: título a la izquierda y, en escritorio, una entradilla a la derecha.
export function SectionHead({ title, intro }: { title: React.ReactNode; intro?: React.ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr] md:items-end">
      <h2 className="font-display text-3xl font-medium leading-[1.1] md:text-[2.5rem]">{title}</h2>
      {intro && <p className="max-w-md leading-relaxed text-slate-500 md:justify-self-end">{intro}</p>}
    </div>
  );
}

export function Card({ children, tone = "white", className = "" }: { children: React.ReactNode; tone?: "white" | "sage" | "warn"; className?: string }) {
  const t = tone === "sage" ? "bg-sage-soft" : tone === "warn" ? "bg-[#fbf6ea]" : "bg-white ring-1 ring-black/[0.06]";
  return <div className={`rounded-3xl p-6 md:p-8 ${t} ${className}`}>{children}</div>;
}

export function Checklist({ items, kind = "yes" }: { items: React.ReactNode[]; kind?: "yes" | "no" }) {
  return (
    <ul className="divide-y divide-black/[0.06]">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3.5 py-3 leading-relaxed first:pt-0 last:pb-0">
          <span aria-hidden className={`mt-[0.55em] block size-1.5 shrink-0 rounded-full ${kind === "yes" ? "bg-sage" : "bg-slate-300"}`} />
          <span className={kind === "no" ? "text-slate-600" : undefined}>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Source({ children }: { children: React.ReactNode }) {
  return <p className="mt-10 max-w-3xl border-t border-black/[0.06] pt-5 text-[12px] leading-relaxed text-slate-400">Fuente: {children}</p>;
}

export function ClosingCta() {
  return (
    <section className="relative mt-24 overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-white md:px-14 md:py-20">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-sage/40 blur-3xl" />
      <div className="relative max-w-2xl">
        <h2 className="font-display text-3xl font-medium leading-[1.1] md:text-5xl">No te prometemos un resultado. Te decimos la verdad sobre tu caso.</h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">
          Responde unas preguntas y, si tu caso encaja, un abogado colegiado de un despacho colaborador lo revisa contigo.
        </p>
        <div className="mt-8"><CtaButton light /></div>
      </div>
    </section>
  );
}
