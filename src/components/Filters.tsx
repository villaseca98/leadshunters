"use client";
import { useState, type ReactNode } from "react";

/** Filtros plegables: en móvil quedan recogidos tras un botón, en ordenador siempre a la vista. */
export function Filters({ children, active = 0 }: { children: ReactNode; active?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-inset ring-slate-200 md:hidden"
      >
        <span>Filtros{active ? ` · ${active} activos` : ""}</span>
        <span className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      <div className={`${open ? "mt-2 block" : "hidden"} md:mt-0 md:block`}>{children}</div>
    </div>
  );
}
