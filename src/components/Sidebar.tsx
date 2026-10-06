"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Resumen", icon: "◧" },
  { section: "Captar despachos" },
  { href: "/prospeccion", label: "Prospección", icon: "⌖" },
  { href: "/prospeccion/llamar", label: "Llamar despachos", icon: "☏" },
  { section: "Servicio a clientes" },
  { href: "/cola", label: "Cola de llamadas", icon: "⚡" },
  { href: "/leads", label: "Leads", icon: "☰" },
  { href: "/citas", label: "Consultas", icon: "◷" },
  { href: "/clientes", label: "Clientes", icon: "⚖" },
  { href: "/facturacion", label: "Facturación", icon: "€" },
  { section: "Sistema" },
  { href: "/ajustes", label: "Ajustes e integraciones", icon: "⚙" },
] as const;

export function Sidebar({ user, queueCount }: { user: { name: string; role: string }; queueCount: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? path === "/" : href === "/prospeccion" ? path === "/prospeccion" || (/^\/prospeccion\/[^l]/.test(path)) : path.startsWith(href);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white lg:hidden">
        <span className="font-semibold">Leads Hunters</span>
        <button onClick={() => setOpen(!open)} className="rounded px-2 py-1 text-sm ring-1 ring-slate-700">
          Menú
        </button>
      </div>
      <aside
        className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-20 w-64 overflow-y-auto bg-slate-900 px-3 pb-6 pt-16 text-slate-300 lg:block lg:pt-6`}
      >
        <div className="mb-8 hidden px-3 lg:block">
          <div className="text-lg font-bold tracking-tight text-white">
            Leads<span className="text-indigo-400">Hunters</span>
          </div>
          <div className="text-xs text-slate-500">Segunda Oportunidad · B2B</div>
        </div>
        <nav className="space-y-0.5">
          {NAV.map((n, i) =>
            "section" in n ? (
              <div key={i} className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {n.section}
              </div>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(n.href) ? "bg-slate-800 text-white" : "hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <span className="w-4 text-center text-slate-400">{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {n.href === "/cola" && queueCount > 0 && (
                  <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-semibold text-white">{queueCount}</span>
                )}
              </Link>
            ),
          )}
        </nav>
        <div className="mt-10 border-t border-slate-800 px-3 pt-4 text-sm">
          <div className="font-medium text-white">{user.name}</div>
          <div className="text-xs text-slate-500">{user.role === "admin" ? "Administrador" : "Telefonista"}</div>
          <form action="/logout" method="post" className="mt-3">
            <button className="text-xs text-slate-400 hover:text-white">Cerrar sesión</button>
          </form>
        </div>
      </aside>
    </>
  );
}
