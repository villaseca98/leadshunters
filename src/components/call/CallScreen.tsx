"use client";
import { useEffect, useState } from "react";
import { btn, input, label } from "@/components/ui";

type Lead = {
  id: string; full_name: string; phone: string | null; email: string | null; province: string | null;
  debt_amount: number | null; creditors_count: number | null; monthly_income: number | null; employment_status: string | null;
  owns_home: boolean | null; prior_lso: boolean | null; criminal_record: boolean | null; created_at: string;
};

const OUTCOMES = [
  { v: "cita_agendada", l: "✓ Cita agendada", cls: btn.success },
  { v: "no_contesta", l: "No contesta", cls: btn.secondary },
  { v: "buzon", l: "Buzón", cls: btn.secondary },
  { v: "volver_a_llamar", l: "Volver a llamar", cls: btn.secondary },
  { v: "no_cualificado", l: "No cualificado", cls: btn.secondary },
  { v: "no_interesado", l: "No interesado", cls: btn.secondary },
  { v: "numero_erroneo", l: "Nº erróneo", cls: btn.danger },
];

function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${m}m` : `${m}:${String(r).padStart(2, "0")}`;
}

const tri = (v: boolean | null) => (v == null ? "" : v ? "si" : "no");

export function CallScreen({
  lead, action, defaultSlot, fromQueue, clientFilter, calendarUrl,
}: {
  lead: Lead;
  action: (fd: FormData) => void;
  defaultSlot: string;
  fromQueue: boolean;
  clientFilter: string;
  calendarUrl: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [started] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sinceArrival = now - new Date(lead.created_at).getTime();

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="started_at" value={started} />
      <input type="hidden" name="from" value={fromQueue ? "cola" : ""} />
      <input type="hidden" name="client_filter" value={clientFilter} />

      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-900 p-4 text-white">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-slate-400">Llamar a</div>
          <div className="text-xl font-semibold">{lead.full_name}</div>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="mt-1 inline-block text-2xl font-bold tracking-wide text-emerald-400 hover:text-emerald-300">
              {lead.phone}
            </a>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Entró hace</div>
          <div className={`text-lg font-semibold tabular-nums ${sinceArrival > 5 * 60_000 ? "text-amber-400" : "text-emerald-400"}`}>{elapsed(sinceArrival)}</div>
          <div className="mt-1 text-xs text-slate-400">En llamada: <span className="tabular-nums">{elapsed(now - started)}</span></div>
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">Cualificación (confírmalo en la llamada)</legend>
        <label><span className={label}>Nombre</span><input name="full_name" defaultValue={lead.full_name} className={input} /></label>
        <label><span className={label}>Teléfono</span><input name="phone" defaultValue={lead.phone ?? ""} className={input} /></label>
        <label><span className={label}>Email</span><input name="email" defaultValue={lead.email ?? ""} className={input} /></label>
        <label><span className={label}>Deuda total (€)</span><input name="debt_amount" inputMode="numeric" defaultValue={lead.debt_amount ?? ""} className={input} placeholder="ej. 25000" /></label>
        <label><span className={label}>Nº de acreedores</span><input name="creditors_count" inputMode="numeric" defaultValue={lead.creditors_count ?? ""} className={input} placeholder="bancos, financieras, Hacienda…" /></label>
        <label><span className={label}>Ingresos/mes (€)</span><input name="monthly_income" inputMode="numeric" defaultValue={lead.monthly_income ?? ""} className={input} /></label>
        <label>
          <span className={label}>Situación laboral</span>
          <select name="employment_status" defaultValue={lead.employment_status ?? ""} className={input}>
            <option value="">—</option><option value="asalariado">Asalariado</option><option value="autonomo">Autónomo</option>
            <option value="desempleado">Desempleado</option><option value="pensionista">Pensionista</option><option value="otro">Otro</option>
          </select>
        </label>
        <label><span className={label}>Provincia</span><input name="province" defaultValue={lead.province ?? ""} className={input} /></label>
        <label>
          <span className={label}>¿Vivienda en propiedad?</span>
          <select name="owns_home" defaultValue={tri(lead.owns_home)} className={input}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select>
        </label>
        <label>
          <span className={label}>¿Usó la LSO en 5 años?</span>
          <select name="prior_lso" defaultValue={tri(lead.prior_lso)} className={input}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select>
        </label>
        <label>
          <span className={label}>¿Condenas por delitos económicos?</span>
          <select name="criminal_record" defaultValue={tri(lead.criminal_record)} className={input}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select>
        </label>
      </fieldset>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <span className={label}>Notas de la llamada (las verá el despacho si se agenda cita)</span>
        <textarea name="notes" rows={3} className={input} placeholder="Tipo de deudas, urgencia (embargos, llamadas de recobro), disponibilidad…" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-slate-800">Resultado</div>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map((o) => (
            <button
              type="button"
              key={o.v}
              onClick={() => setOutcome(o.v)}
              className={`${o.cls} ${outcome === o.v ? "ring-2 ring-indigo-500 ring-offset-2" : ""}`}
            >
              {o.l}
            </button>
          ))}
        </div>
        {outcome && <input type="hidden" name="outcome" value={outcome} />}

        {outcome === "cita_agendada" && (
          <div className="mt-4 grid gap-3 rounded-lg bg-emerald-50 p-3 sm:grid-cols-3">
            <label><span className={label}>Fecha y hora de la consulta</span><input type="datetime-local" name="scheduled_at" required defaultValue={defaultSlot} className={input} /></label>
            <label>
              <span className={label}>Modalidad</span>
              <select name="mode" className={input}><option value="telefono">Teléfono</option><option value="videollamada">Videollamada</option><option value="presencial">Presencial</option></select>
            </label>
            <label><span className={label}>Nota para el abogado</span><input name="consultation_notes" className={input} /></label>
            {calendarUrl && (
              <a href={calendarUrl} target="_blank" className="text-xs font-medium text-emerald-700 sm:col-span-3">Abrir la agenda del despacho ↗</a>
            )}
          </div>
        )}
        {outcome === "volver_a_llamar" && (
          <div className="mt-4 max-w-xs">
            <label><span className={label}>¿Cuándo volver a llamar?</span><input type="datetime-local" name="callback_at" required className={input} /></label>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button className={btn.primary} disabled={!outcome}>
            {fromQueue ? "Guardar y siguiente →" : "Guardar"}
          </button>
          {!outcome && <span className="text-xs text-slate-500">Elige un resultado</span>}
        </div>
      </div>
    </form>
  );
}
