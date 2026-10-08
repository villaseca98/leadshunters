"use client";
import { useOptimistic, useState, useTransition } from "react";
import { bumpMarker, deleteMarker, setMarker } from "@/app/(app)/clientes/markers";

type Marker = { id: string; label: string; unit: "num" | "eur"; billable: boolean; value: number };

const fmt = (m: Marker, v: number) =>
  m.unit === "eur" ? v.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }) : v.toLocaleString("es-ES");

/** Marcadores editables: + y − para contar, o escribir el número; los importes marcados se suman a la factura. */
export function MarkersEditor({ markers }: { markers: Marker[] }) {
  const [list, apply] = useOptimistic(markers, (cur: Marker[], a: { id: string; value?: number; delta?: number; remove?: boolean }) =>
    a.remove ? cur.filter((m) => m.id !== a.id) : cur.map((m) => (m.id === a.id ? { ...m, value: a.value ?? m.value + (a.delta ?? 0) } : m)),
  );
  const [, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const step = (m: Marker) => (m.unit === "eur" ? 10 : 1);

  return (
    <ul className="grid gap-2">
      {list.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{m.label}</div>
            <div className="text-[11px] text-slate-500">{m.unit === "eur" ? (m.billable ? "€ · se suma a la factura" : "€ · solo informativo") : "contador"}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={`Restar a ${m.label}`}
              onClick={() => start(async () => { apply({ id: m.id, delta: -step(m) }); await bumpMarker(m.id, -step(m)); })}
              className="grid size-9 place-items-center rounded-full bg-slate-100 text-lg font-semibold hover:bg-slate-200"
            >−</button>
            {editing === m.id ? (
              <input
                autoFocus
                defaultValue={m.value}
                inputMode="decimal"
                className="w-24 rounded-lg bg-slate-50 px-2 py-1.5 text-center text-sm ring-1 ring-slate-300"
                onBlur={(e) => { const v = e.currentTarget.value; setEditing(null); start(async () => { apply({ id: m.id, value: Number(v.replace(",", ".")) || 0 }); await setMarker(m.id, v); }); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
            ) : (
              <button type="button" onClick={() => setEditing(m.id)} className="num min-w-16 rounded-lg px-2 py-1.5 text-center text-base font-semibold hover:bg-slate-50" title="Escribir el valor">
                {fmt(m, m.value)}
              </button>
            )}
            <button
              type="button"
              aria-label={`Sumar a ${m.label}`}
              onClick={() => start(async () => { apply({ id: m.id, delta: step(m) }); await bumpMarker(m.id, step(m)); })}
              className="grid size-9 place-items-center rounded-full bg-ink text-lg font-semibold text-white hover:bg-slate-800"
            >+</button>
            <button
              type="button"
              aria-label={`Quitar ${m.label}`}
              onClick={() => { if (confirm(`¿Quitar «${m.label}»?`)) start(async () => { apply({ id: m.id, remove: true }); await deleteMarker(m.id); }); }}
              className="ml-1 text-xs text-slate-400 hover:text-rose-600"
            >✕</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
