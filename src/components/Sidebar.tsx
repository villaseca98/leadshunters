"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function Logo({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="var(--color-blaze)" />
        <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--color-ink)" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="2.6" fill="var(--color-ink)" />
        <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="var(--color-ink)" strokeWidth="2.2" />
      </svg>
      <span className={`font-display text-[15px] font-semibold leading-none tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        leads<span className="text-blaze">hunters</span>
      </span>
    </span>
  );
}

const MAIN = [
  { href: "/", label: "Inicio", icon: IconHome },
  { href: "/leads", label: "Leads", icon: IconPeople },
  { href: "/prospeccion", label: "Despachos", icon: IconTarget },
];
const MORE = [
  { href: "/energia", label: "Luz y placas", hint: "Leads de Recorta desde Instagram" },
  { href: "/informes", label: "Informes", hint: "Despachos, luz y placas: qué mejorar" },
  { href: "/particulares", label: "Test particulares", hint: "Captación propia con consentimiento" },
  { href: "/citas", label: "Consultas", hint: "Agenda y asistencia" },
  { href: "/clientes", label: "Clientes", hint: "Despachos que pagan" },
  { href: "/facturacion", label: "Facturación", hint: "Cuota + consultas" },
  { href: "/prospeccion/llamar", label: "Llamar despachos", hint: "Venta B2B, el siguiente mejor" },
  { href: "/ajustes", label: "Ajustes", hint: "Usuarios, n8n e integraciones" },
];

export function Sidebar({ user, queueCount }: { user: { name: string; role: string }; queueCount: number }) {
  const path = usePathname();
  const [sheet, setSheet] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? path === "/" : href === "/prospeccion" ? path === "/prospeccion" || /^\/prospeccion\/(?!llamar)/.test(path) : path.startsWith(href);
  const moreActive = MORE.some((m) => isActive(m.href));

  return (
    <>
      {/* ---------- Móvil: barra superior ---------- */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-paper/85 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}>
        <Link href="/" aria-label="Inicio"><Logo /></Link>
        <button onClick={() => setSheet(true)} className="grid size-10 place-items-center rounded-full bg-ink text-sm font-semibold text-white" aria-label="Menú y cuenta">
          {user.name.slice(0, 1).toUpperCase()}
        </button>
      </header>

      {/* ---------- Móvil: dock inferior ---------- */}
      <nav
        className="fixed inset-x-3 bottom-3 z-40 lg:hidden"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Navegación principal"
      >
        <div className="relative grid grid-cols-5 items-end rounded-[1.75rem] bg-ink px-2 pb-2 pt-2 text-white shadow-[0_12px_40px_-12px_rgb(0_0_0/0.55)]">
          <DockItem href={MAIN[0].href} label={MAIN[0].label} active={isActive("/")} Icon={MAIN[0].icon} />
          <DockItem href={MAIN[1].href} label={MAIN[1].label} active={isActive("/leads")} Icon={MAIN[1].icon} />
          <Link
            href="/cola"
            className="relative -mt-8 flex flex-col items-center gap-1"
            aria-label={`Cazar: cola de llamadas, ${queueCount} esperando`}
          >
            <span className={`grid size-[4.25rem] place-items-center rounded-full border-4 border-paper bg-blaze text-blaze-ink ${queueCount > 0 ? "lh-pulse" : ""}`}>
              <IconBolt className="size-7" />
            </span>
            {queueCount > 0 && (
              <span className="num absolute -top-1 right-1/2 translate-x-9 rounded-full bg-white px-1.5 py-0.5 text-[11px] font-bold text-ink">{queueCount}</span>
            )}
            <span className={`text-[11px] font-semibold ${isActive("/cola") ? "text-blaze" : "text-white/80"}`}>Cazar</span>
          </Link>
          <DockItem href={MAIN[2].href} label={MAIN[2].label} active={isActive("/prospeccion")} Icon={MAIN[2].icon} />
          <button onClick={() => setSheet(true)} className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 ${moreActive ? "text-blaze" : "text-white/70"}`}>
            <IconGrid className="size-6" />
            <span className="text-[11px] font-semibold">Más</span>
          </button>
        </div>
      </nav>

      {/* ---------- Móvil: hoja "Más" ---------- */}
      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Más secciones">
          <button className="absolute inset-0 bg-ink/50" onClick={() => setSheet(false)} aria-label="Cerrar" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] bg-paper px-4 pt-3" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <div className="font-semibold">{user.name}</div>
                <div className="text-xs text-slate-500">{user.role === "admin" ? "Administrador" : "Telefonista"}</div>
              </div>
              <form action="/logout" method="post"><button className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300">Salir</button></form>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {MORE.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} onClick={() => setSheet(false)} className={`block h-full rounded-2xl p-3.5 ${isActive(m.href) ? "bg-ink text-white" : "bg-white text-ink"}`}>
                    <div className="font-semibold">{m.label}</div>
                    <div className={`mt-0.5 text-xs ${isActive(m.href) ? "text-white/70" : "text-slate-500"}`}>{m.hint}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ---------- Ordenador: barra lateral ---------- */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-paper px-4 py-6 lg:flex">
        <Link href="/" className="px-2"><Logo /></Link>
        <Link href="/cola" className="group mt-7 flex items-center gap-3 rounded-[1.25rem] bg-ink p-3.5 text-white">
          <span className={`grid size-11 place-items-center rounded-full bg-blaze text-blaze-ink ${queueCount > 0 ? "lh-pulse" : ""}`}><IconBolt className="size-5" /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">Cazar</span>
            <span className="block text-xs text-white/60">{queueCount ? `${queueCount} leads esperando` : "Cola al día"}</span>
          </span>
          <span className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white">→</span>
        </Link>
        <nav className="mt-6 space-y-0.5 text-sm">
          {[...MAIN, ...MORE].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center justify-between rounded-full px-3 py-2 font-medium ${isActive(n.href) ? "bg-white text-ink ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/60 hover:text-ink"}`}
            >
              {n.label}
              {isActive(n.href) && <span className="size-1.5 rounded-full bg-blaze" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-slate-200 px-2 pt-4">
          <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="text-xs text-slate-500">{user.role === "admin" ? "Administrador" : "Telefonista"}</div>
          </div>
          <form action="/logout" method="post"><button className="text-xs font-medium text-slate-500 hover:text-ink">Salir</button></form>
        </div>
      </aside>
    </>
  );
}

function DockItem({ href, label, active, Icon }: { href: string; label: string; active: boolean; Icon: (p: { className?: string }) => React.ReactNode }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 ${active ? "text-blaze" : "text-white/70"}`}>
      <Icon className="size-6" />
      <span className="text-[11px] font-semibold">{label}</span>
    </Link>
  );
}

const sv = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconHome({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...sv}><path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" /></svg>;
}
function IconPeople({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...sv}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2" /></svg>;
}
function IconTarget({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...sv}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" /></svg>;
}
function IconGrid({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} {...sv}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></svg>;
}
export function IconBolt({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M13.2 2.5 4.8 13.3c-.4.5 0 1.2.6 1.2h5.1l-1.2 6.8c-.1.7.8 1.1 1.2.5l8.4-10.8c.4-.5 0-1.2-.6-1.2h-5.1l1.2-6.8c.1-.7-.8-1.1-1.2-.5Z" /></svg>;
}
