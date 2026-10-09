"use client";
// Piezas interactivas de la operativa: estado editable en el sitio, tablero con arrastrar y soltar y acciones en bloque.
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { bulkLineLeads, quickClientStatus, quickLineNote, quickLineStatus, type BulkAction } from "@/app/(app)/operativa";
import { eur, telHref, waHref } from "@/lib/format";
import type { Tone } from "@/lib/labels";
import { TONES } from "./ui";

type StatusMap = Record<string, { label: string; tone: Tone }>;

const selectBase = "cursor-pointer appearance-none rounded-full py-1 pl-2.5 pr-6 text-xs font-medium ring-1 ring-inset bg-[length:10px] bg-[right_0.5rem_center] bg-no-repeat disabled:opacity-60";
const caret = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23475569' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")" };

/** Píldora de estado que se cambia en el sitio. */
function StatusPill({ map, value, onChange, pending, label }: { map: StatusMap; value: string; onChange: (v: string) => void; pending?: boolean; label: string }) {
  const tone = map[value]?.tone ?? "slate";
  return (
    <select aria-label={label} value={value} disabled={pending} onChange={(e) => onChange(e.target.value)} className={`${selectBase} ${TONES[tone]}`} style={caret}>
      {Object.entries(map).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </select>
  );
}

/** Estado de un lead de línea editable (fichas, Inicio). */
export function LineStatusSelect({ id, value, map }: { id: string; value: string; map: StatusMap }) {
  const [cur, setCur] = useOptimistic(value);
  const [pending, start] = useTransition();
  return <StatusPill label="Estado del lead" map={map} value={cur} pending={pending} onChange={(v) => start(async () => { setCur(v); await quickLineStatus(id, v); })} />;
}

const CLIENT_STATUS: StatusMap = { activo: { label: "Activo", tone: "emerald" }, pausado: { label: "Pausado", tone: "amber" }, baja: { label: "Baja", tone: "slate" } };

/** Estado de un cliente (activo, pausado, baja) editable desde la lista. */
export function ClientStatusSelect({ kind, id, value }: { kind: "despacho" | "linea"; id: string; value: string }) {
  const [cur, setCur] = useOptimistic(value);
  const [pending, start] = useTransition();
  return <StatusPill label="Estado del cliente" map={CLIENT_STATUS} value={cur} pending={pending} onChange={(v) => start(async () => { setCur(v); await quickClientStatus(kind, id, v); })} />;
}

export type LeadRow = {
  id: string; full_name: string; phone: string; province: string | null; line_id: string; line_label: string; company: string;
  priority: string; reasons: string; status: string; channel: string; campaign: string | null; value: number | null; entered: string; client_id: string | null;
};
export type ClientOption = { id: string; name: string; line_id: string };

const PRIO_TONE: Record<string, Tone> = { A: "emerald", B: "amber", C: "slate" };
const COLUMNS = ["nuevo", "no_contesta", "contactado", "propuesta", "ganado", "descartado"];
const COL_BAR: Record<string, string> = { nuevo: "bg-sky-400", no_contesta: "bg-amber-400", contactado: "bg-indigo-400", propuesta: "bg-violet-400", ganado: "bg-emerald-500", descartado: "bg-slate-300" };

/**
 * Leads de las líneas como lista (con casillas y acciones en bloque) o como tablero por estados
 * (arrastra la tarjeta a otra columna; en el móvil, el desplegable de la tarjeta hace lo mismo).
 */
export function LineLeadsWorkspace({ rows, view, maps, clients, showLine, valueLabel }: {
  rows: LeadRow[];
  view: "lista" | "tablero";
  /** etiquetas de estado de cada línea (propuesta y cierre cambian de nombre) y "" = las genéricas */
  maps: Record<string, StatusMap>;
  clients: ClientOption[];
  showLine: boolean;
  valueLabel: string;
}) {
  const [list, move] = useOptimistic(rows, (cur, { ids, status }: { ids: string[]; status: string }) => cur.map((r) => (ids.includes(r.id) ? { ...r, status } : r)));
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const generic = maps[""];
  const mapFor = (r: LeadRow) => maps[r.line_id] ?? generic;
  const visibleSel = sel.filter((id) => list.some((r) => r.id === id));

  function setStatus(ids: string[], status: string) {
    start(async () => {
      move({ ids, status });
      if (ids.length === 1) {
        const r = await quickLineStatus(ids[0], status);
        setMsg(r.ok ? null : { ok: false, text: r.error ?? "No se pudo cambiar" });
      } else {
        const r = await bulkLineLeads(ids, { kind: "status", status });
        setMsg({ ok: r.ok, text: r.ok ? `${r.n} leads pasados a «${generic[status]?.label ?? status}».` : r.error ?? "No se pudo" });
        setSel([]);
      }
    });
  }

  function bulk(action: BulkAction, done: string) {
    start(async () => {
      const r = await bulkLineLeads(visibleSel, action);
      setMsg({ ok: r.ok, text: r.ok ? `${r.n} ${r.n === 1 ? "lead" : "leads"} ${done}.` : r.error ?? "No se pudo" });
      if (r.ok) setSel([]);
    });
  }

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allOn = list.length > 0 && visibleSel.length === list.length;
  const selLines = new Set(list.filter((r) => visibleSel.includes(r.id)).map((r) => r.line_id));
  const assignable = clients.filter((c) => selLines.size === 1 && selLines.has(c.line_id));

  return (
    <div className="relative">
      {msg && (
        <p role="status" className={`mb-3 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800"}`}>
          {msg.text}<button onClick={() => setMsg(null)} className="text-xs underline">Cerrar</button>
        </p>
      )}

      {view === "tablero" ? (
        <div className="lh-rail -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {COLUMNS.map((col) => {
            const items = list.filter((r) => r.status === col);
            const total = items.reduce((a, r) => a + (r.value ?? 0), 0);
            return (
              <section
                key={col}
                aria-label={generic[col].label}
                onDragOver={(e) => { e.preventDefault(); setOver(col); }}
                onDragLeave={() => setOver((o) => (o === col ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = drag ?? e.dataTransfer.getData("text/plain"); setDrag(null); const r = list.find((x) => x.id === id); if (r && r.status !== col) setStatus([id], col); }}
                className={`flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-2xl border bg-white/70 sm:w-64 ${over === col ? "border-blaze ring-2 ring-blaze/30" : "border-slate-200"}`}
              >
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold"><span className={`size-2.5 rounded-full ${COL_BAR[col]}`} />{generic[col].label}</span>
                  <span className="num text-xs text-slate-500">{items.length}{total ? ` · ${eur(total)}` : ""}</span>
                </header>
                <ol className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                  {items.map((r) => (
                    <li
                      key={r.id}
                      draggable
                      onDragStart={(e) => { setDrag(r.id); e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => setDrag(null)}
                      className={`cursor-grab rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm active:cursor-grabbing ${drag === r.id ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/lineas/${r.id}`} className="min-w-0 truncate text-sm font-semibold hover:underline">{r.full_name}</Link>
                        <span className={`shrink-0 rounded-full px-1.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[PRIO_TONE[r.priority] ?? "slate"]}`}>{r.priority}</span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{showLine ? `${r.line_label} · ` : ""}{r.entered}{r.province ? ` · ${r.province}` : ""}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex gap-1">
                          <a href={telHref(r.phone)} className="grid size-8 place-items-center rounded-lg bg-slate-100 text-sm hover:bg-slate-200" aria-label={`Llamar a ${r.full_name}`}>📞</a>
                          <a href={waHref(r.phone)} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-lg bg-slate-100 text-sm hover:bg-slate-200" aria-label={`WhatsApp a ${r.full_name}`}>💬</a>
                        </div>
                        {/* alternativa al arrastre (móvil y teclado) */}
                        <select aria-label="Mover a" value={r.status} onChange={(e) => setStatus([r.id], e.target.value)} className={`${selectBase} max-w-32 ${TONES.slate}`} style={caret}>
                          {COLUMNS.map((c) => <option key={c} value={c}>{c === r.status ? "Mover a…" : mapFor(r)[c].label}</option>)}
                        </select>
                      </div>
                    </li>
                  ))}
                  {items.length === 0 && <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">Suelta aquí</li>}
                </ol>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="lh-table overflow-x-auto rounded-[var(--radius-card)] border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Elegir todos" checked={allOn} onChange={() => setSel(allOn ? [] : list.map((r) => r.id))} className="size-4 accent-[var(--color-blaze)]" /></th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Entró</th>
                {showLine && <th className="px-4 py-3">Línea</th>}
                <th className="px-4 py-3 max-md:hidden">Datos</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 max-md:hidden">Canal</th>
                <th className="px-4 py-3 max-md:hidden">{valueLabel}</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => (
                <tr key={r.id} className={visibleSel.includes(r.id) ? "bg-orange-50/60" : "hover:bg-slate-50"}>
                  <td className="px-4 py-3 align-middle"><input type="checkbox" aria-label={`Elegir ${r.full_name}`} checked={visibleSel.includes(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[var(--color-blaze)]" /></td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle" data-primary="">
                    <Link href={`/lineas/${r.id}`} className="font-semibold text-ink underline decoration-indigo-400 decoration-2 underline-offset-4">{r.full_name}</Link>
                    <div className="text-xs"><a className="text-indigo-600" href={telHref(r.phone)}>{r.phone}</a>{r.province ? ` · ${r.province}` : ""}</div>
                    {noteFor === r.id && (
                      <form
                        className="mt-2 flex gap-1"
                        action={(fd) => start(async () => { const ok = (await quickLineNote(r.id, String(fd.get("t") ?? ""))).ok; setMsg({ ok, text: ok ? `Nota guardada en ${r.full_name}.` : "Escribe la nota" }); if (ok) setNoteFor(null); })}
                      >
                        <input name="t" autoFocus placeholder="Nota rápida…" className="min-h-9 w-48 rounded-lg bg-slate-50 px-2.5 text-sm ring-1 ring-inset ring-slate-200" />
                        <button className="rounded-lg bg-ink px-3 text-xs font-semibold text-white">Guardar</button>
                      </form>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-xs" data-label="Entró">{r.entered}</td>
                  {showLine && <td className="whitespace-nowrap px-4 py-3 align-middle" data-label="Línea">{r.line_label}<div className="text-xs text-slate-500">{r.company}</div></td>}
                  <td className="max-w-64 truncate px-4 py-3 align-middle text-xs text-slate-600 max-md:!hidden">{r.reasons}</td>
                  <td className="px-4 py-3 align-middle" data-label="Prioridad"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[PRIO_TONE[r.priority] ?? "slate"]}`}>{r.priority}</span></td>
                  <td className="px-4 py-3 align-middle" data-label="Estado"><StatusPill label={`Estado de ${r.full_name}`} map={mapFor(r)} value={r.status} onChange={(v) => setStatus([r.id], v)} /></td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle max-md:!hidden">{r.channel}<div className="max-w-40 truncate text-xs text-slate-500">{r.campaign}</div></td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle max-md:!hidden">{r.value != null ? eur(r.value) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle">
                    <div className="flex justify-end gap-1">
                      <a href={telHref(r.phone)} className="grid size-8 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200" aria-label={`Llamar a ${r.full_name}`} title="Llamar">📞</a>
                      <a href={waHref(r.phone)} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200" aria-label={`WhatsApp a ${r.full_name}`} title="WhatsApp">💬</a>
                      <button type="button" onClick={() => setNoteFor(noteFor === r.id ? null : r.id)} className="grid size-8 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200" aria-label={`Nota para ${r.full_name}`} title="Nota rápida">📝</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Barra de acciones en bloque */}
      {view === "lista" && visibleSel.length > 0 && (
        <div className="sticky bottom-24 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-ink p-3 text-sm text-white shadow-xl lg:bottom-4">
          <span className="font-semibold">{visibleSel.length} elegidos</span>
          <select aria-label="Cambiar estado" disabled={pending} value="" onChange={(e) => e.target.value && setStatus(visibleSel, e.target.value)} className="min-h-9 rounded-lg bg-white/10 px-2 text-white ring-1 ring-inset ring-white/20 [&>option]:text-ink">
            <option value="">Cambiar estado…</option>
            {COLUMNS.map((c) => <option key={c} value={c}>{generic[c].label}</option>)}
          </select>
          <select aria-label="Cambiar prioridad" disabled={pending} value="" onChange={(e) => e.target.value && bulk({ kind: "priority", priority: e.target.value }, `pasados a prioridad ${e.target.value}`)} className="min-h-9 rounded-lg bg-white/10 px-2 text-white ring-1 ring-inset ring-white/20 [&>option]:text-ink">
            <option value="">Prioridad…</option>
            {["A", "B", "C"].map((p) => <option key={p} value={p}>Prioridad {p}</option>)}
          </select>
          <select
            aria-label="Asignar cliente"
            disabled={pending || selLines.size !== 1}
            value=""
            title={selLines.size !== 1 ? "Elige leads de una sola línea para asignarles cliente" : undefined}
            onChange={(e) => e.target.value && bulk({ kind: "client", clientId: e.target.value === "-" ? null : e.target.value }, e.target.value === "-" ? "sin cliente" : "asignados al cliente")}
            className="min-h-9 rounded-lg bg-white/10 px-2 text-white ring-1 ring-inset ring-white/20 disabled:opacity-50 [&>option]:text-ink"
          >
            <option value="">{selLines.size === 1 ? "Asignar cliente…" : "Cliente (una línea)"}</option>
            {assignable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="-">Quitar cliente</option>
          </select>
          <button disabled={pending} onClick={() => bulk({ kind: "llamar_ya" }, "puestos en la cola para llamar ya")} className="min-h-9 rounded-lg bg-blaze px-3 font-semibold text-blaze-ink">Llamar ya</button>
          <button onClick={() => setSel([])} className="ml-auto min-h-9 rounded-lg px-3 text-white/70 hover:text-white">Cancelar</button>
        </div>
      )}
    </div>
  );
}
