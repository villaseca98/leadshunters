"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { askClientAi, makeClientReport, type AiFormState } from "@/app/(app)/clientes/ai";
import type { AiMessage, AiPlan } from "@/lib/services/clientAi";

type Report = { id: string; month: string; body: string; created_at: string };

const shell = "rounded-[var(--radius-card)] border border-slate-200 bg-white";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60";

/**
 * Asistente IA del cliente: le cuentas el caso y deja montadas sus condiciones, marcadores y plan;
 * cada mes genera el informe con la evolución y los pasos a seguir.
 */
export function ClientAi({ kind, clientId, messages, plan, reports, month, monthName, hasKey, fresh }: {
  kind: "despacho" | "linea";
  clientId: string;
  messages: AiMessage[];
  plan: AiPlan | null;
  reports: Report[];
  month: string;
  monthName: string;
  hasKey: boolean;
  fresh?: boolean;
}) {
  const [chat, send, sending] = useActionState<AiFormState, FormData>(async (prev, fd) => {
    const r = await askClientAi(kind, clientId, prev, fd);
    return r.ok ? r : { ...r, ok: prev.ok }; // ok cambia solo al acertar: vacía la caja (key) sin perder el texto si falla
  }, {});
  const [rep, report, reporting] = useActionState<AiFormState>(makeClientReport.bind(null, kind, clientId, month), {});
  const [pending, setPending] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const current = reports.find((r) => r.month === month);
  const [picked, setOpen] = useState<string | null | undefined>(undefined);
  const open = picked === undefined ? reports[0]?.id ?? null : picked; // el último informe, abierto

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  return (
    <section className={`${shell} overflow-hidden ${fresh ? "ring-2 ring-blaze" : ""}`}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">✨ Asistente IA del cliente</h2>
        {plan && <span className="text-[11px] text-emerald-700">Plan montado</span>}
      </header>

      <div className="p-4 sm:p-5">
        {!hasKey && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Para que la IA funcione falta la clave de Claude. <Link href="/ajustes#ia" className="font-semibold underline">Pégala en Ajustes</Link>.
          </p>
        )}

        <div ref={list} className="mb-3 max-h-80 space-y-2 overflow-y-auto">
          {messages.length === 0 && !sending && (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
              {fresh ? "Cliente creado. " : ""}Cuéntame en dos líneas cómo es este cliente: qué te paga y por qué (fijo, por show-up, por venta, comisión…), qué quiere conseguir y cualquier detalle especial.
              Yo dejo puestas sus condiciones, los marcadores que hay que contar y un plan con métricas y pasos. Cada mes te hago el informe.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-ink text-white" : "bg-slate-100 text-ink"}`}>{m.text}</div>
            </div>
          ))}
          {sending && pending && (
            <>
              <div className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-ink px-3 py-2 text-sm text-white opacity-70">{pending}</div></div>
              <div className="flex justify-start"><div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">Montando el cliente…</div></div>
            </>
          )}
        </div>

        <form action={(fd) => { setPending(String(fd.get("text") ?? "")); send(fd); }} className="flex items-end gap-2">
          <textarea
            key={chat.ok ?? 0}
            name="text"
            rows={2}
            defaultValue={chat.error ? pending : ""}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            autoFocus={fresh}
            placeholder="Ej.: me paga 300 € fijos y 50 € por cada cita que vaya; quiere 20 citas al mes…"
            className="block min-h-11 w-full resize-none rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[15px] ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
          />
          <button disabled={sending} className={`${button} shrink-0 bg-ink text-white hover:bg-slate-800`}>{sending ? "…" : "Enviar"}</button>
        </form>
        {chat.error && <p className="mt-2 text-sm text-rose-700">{chat.error}</p>}

        {plan && (
          <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2"><div className="mb-1 text-xs font-semibold text-slate-500">Acuerdo</div><p>{plan.resumen}</p></div>
            {plan.metricas.length > 0 && <Bullets title="Métricas clave" items={plan.metricas} />}
            {plan.objetivos.length > 0 && <Bullets title="Objetivos" items={plan.objetivos} />}
            {plan.pasos.length > 0 && <div className="sm:col-span-2"><Bullets title="Pasos a seguir" items={plan.pasos} ordered /></div>}
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-500">Informes</div>
            <form action={report}>
              <button disabled={reporting} className={`${button} bg-white text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50`}>
                {reporting ? "Escribiendo informe…" : current ? `Rehacer informe de ${monthName}` : `Generar informe de ${monthName}`}
              </button>
            </form>
          </div>
          {rep.error && <p className="mb-2 text-sm text-rose-700">{rep.error}</p>}
          {reports.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay informes. El informe compara con los meses anteriores y te dice los pasos a seguir.</p> : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="rounded-2xl border border-slate-200">
                  <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium">
                    <span>Informe {r.month}</span><span className="text-slate-400">{open === r.id ? "−" : "+"}</span>
                  </button>
                  {open === r.id && <div className="whitespace-pre-wrap border-t border-slate-100 px-3 py-3 text-sm leading-relaxed text-slate-700">{r.body}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Bullets({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  const L = ordered ? "ol" : "ul";
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-500">{title}</div>
      <L className={`space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((x, i) => <li key={i}>{x}</li>)}</L>
    </div>
  );
}
