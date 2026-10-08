"use client";
import { useEffect, useState } from "react";
import { btn, input, label } from "@/components/ui";

type Lead = {
  id: string; full_name: string; phone: string | null; email: string | null; province: string | null;
  debt_amount: number | null; creditors_count: number | null; monthly_income: number | null; employment_status: string | null;
  owns_home: boolean | null; prior_lso: boolean | null; criminal_record: boolean | null; created_at: string;
  // luz / placas
  business_type?: string | null; monthly_bill?: number | null; tariff?: string | null; contracted_power_kw?: number | null;
  current_supplier?: string | null; roof?: string | null; daytime_share?: number | null; postal_code?: string | null;
};

type Vertical = "lso" | "luz" | "placas";

const WIN: Record<Vertical, { v: string; l: string; cls: string }> = {
  lso: { v: "cita_agendada", l: "✓ Cita agendada", cls: btn.success },
  luz: { v: "oportunidad", l: "✓ Pedir factura y preparar oferta", cls: btn.success },
  placas: { v: "oportunidad", l: "✓ Pasar al instalador", cls: btn.success },
};

const OUTCOMES = [
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
  lead, action, defaultSlot, fromQueue, clientFilter, calendarUrl, vertical = "lso",
}: {
  vertical?: Vertical;
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
  const energy = vertical !== "lso";
  const outcomes = [WIN[vertical], ...OUTCOMES];

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="started_at" value={started} />
      <input type="hidden" name="from" value={fromQueue ? "cola" : ""} />
      <input type="hidden" name="client_filter" value={clientFilter} />

      <div className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Llamar a</div>
            <div className="font-display mt-1 truncate text-2xl font-semibold">{lead.full_name}</div>
            {lead.phone && <div className="mt-1 font-mono text-lg tracking-wide text-white/80">{lead.phone}</div>}
          </div>
          <HeatRing ms={sinceArrival} />
        </div>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className={`${btn.hunt} mt-4 min-h-14 w-full text-base`}>
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" /></svg>
            Llamar ahora
          </a>
        )}
        <div className="mt-3 flex justify-between text-xs text-white/50">
          <span>Entró hace <span className="font-mono text-white/80">{elapsed(sinceArrival)}</span></span>
          <span>En llamada <span className="font-mono text-white/80">{elapsed(now - started)}</span></span>
        </div>
      </div>

      {energy ? <EnergyFields lead={lead} vertical={vertical} /> : (
      <fieldset className="grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-slate-200 bg-white p-4 sm:grid-cols-3 sm:p-5">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Cualificación · confírmala en la llamada</legend>
        <label className="col-span-2 sm:col-span-1"><span className={label}>Nombre</span><input name="full_name" defaultValue={lead.full_name} className={input} /></label>
        <label><span className={label}>Teléfono</span><input name="phone" defaultValue={lead.phone ?? ""} className={input} /></label>
        <label className="col-span-2 sm:col-span-1"><span className={label}>Email</span><input name="email" defaultValue={lead.email ?? ""} className={input} /></label>
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
      )}

      <div className="rounded-[var(--radius-card)] border border-slate-200 bg-white p-4 sm:p-5">
        <span className={label}>{energy ? `Notas de la llamada (las verá ${vertical === "placas" ? "el instalador" : "quien prepare la oferta"})` : "Notas de la llamada (las verá el despacho si se agenda cita)"}</span>
        <textarea name="notes" rows={3} className={input} placeholder={energy
          ? vertical === "placas" ? "Horario de visita, tipo de cubierta, si tiene coche eléctrico o piensa en batería…" : "Cuándo vence su contrato, si tiene permanencia, si le han subido el precio…"
          : "Tipo de deudas, urgencia (embargos, llamadas de recobro), disponibilidad…"} />
      </div>

      <div className="rounded-[var(--radius-card)] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Resultado</div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {outcomes.map((o) => (
            <button
              type="button"
              key={o.v}
              onClick={() => setOutcome(o.v)}
              className={`${o.cls} ${o.v === WIN[vertical].v ? "col-span-2" : ""} ${outcome === o.v ? "ring-2 ring-blaze ring-offset-2" : ""}`}
            >
              {o.l}
            </button>
          ))}
        </div>
        {outcome && <input type="hidden" name="outcome" value={outcome} />}

        {outcome === "cita_agendada" && (
          <div className="mt-4 grid gap-3 rounded-2xl bg-emerald-50 p-3.5 sm:grid-cols-3">
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
        {outcome === "oportunidad" && (
          <div className="mt-4 rounded-2xl bg-emerald-50 p-3.5 text-sm text-emerald-900">
            {vertical === "luz" ? (
              <p>Se crea la oportunidad en <b>Estudio</b>. Pídele una foto de la última factura por WhatsApp o email; con ella preparas la oferta y la marcas como enviada en Oportunidades.</p>
            ) : (
              <p>Se envía al <b>instalador</b> con un enlace para aceptarlo o rechazarlo. Si no responde en su plazo, cuenta como aceptado.</p>
            )}
            <label className="mt-3 block"><span className={label}>{vertical === "luz" ? "Nota para la oferta" : "Nota para el instalador"}</span><input name="deal_notes" className={input} placeholder={vertical === "luz" ? "Mejor por WhatsApp, permanencia hasta marzo…" : "Prefiere visita por la mañana…"} /></label>
          </div>
        )}
        {outcome === "volver_a_llamar" && (
          <div className="mt-4 max-w-xs">
            <label><span className={label}>¿Cuándo volver a llamar?</span><input type="datetime-local" name="callback_at" required className={input} /></label>
          </div>
        )}

        <div className="sticky bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))] z-10 -mx-1 mt-4 flex items-center gap-3 rounded-full bg-white/90 p-1 backdrop-blur lg:bottom-4">
          <button className={`${btn.primary} min-h-12 flex-1 sm:flex-none sm:px-8`} disabled={!outcome}>
            {fromQueue ? "Guardar y cazar el siguiente →" : "Guardar"}
          </button>
          {!outcome && <span className="hidden text-xs text-slate-500 sm:inline">Elige un resultado</span>}
        </div>
      </div>
    </form>
  );
}

/** Anillo que se va "calentando": verde en los 5 minutos de oro, naranja hasta 30, rojo después. */
function HeatRing({ ms }: { ms: number }) {
  const min = ms / 60000;
  const p = Math.min(100, (min / 30) * 100);
  const c = min <= 5 ? "#3f9a67" : min <= 30 ? "#ff5b1a" : "#e11d48";
  return (
    <div className="lh-ring grid size-16 shrink-0 place-items-center rounded-full" style={{ ["--p" as string]: p, ["--c" as string]: c, background: `conic-gradient(${c} ${p}%, rgb(255 255 255 / 0.12) 0)` }}>
      <div className="grid size-[3.4rem] place-items-center rounded-full bg-ink text-center">
        <span className="num text-sm font-semibold leading-none">{min < 60 ? `${Math.floor(min)}′` : `${Math.floor(min / 60)}h`}</span>
      </div>
    </div>
  );
}

const n = (v: number | null | undefined) => (v == null ? "" : String(v));

/** Datos que se confirman en la llamada de luz y placas. */
function EnergyFields({ lead, vertical }: { lead: Lead; vertical: Vertical }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-slate-200 bg-white p-4 sm:grid-cols-3 sm:p-5">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Su factura · confírmala en la llamada</legend>
      <label className="col-span-2 sm:col-span-1"><span className={label}>Nombre</span><input name="full_name" defaultValue={lead.full_name} className={input} /></label>
      <label><span className={label}>Teléfono</span><input name="phone" defaultValue={lead.phone ?? ""} className={input} /></label>
      <label className="col-span-2 sm:col-span-1"><span className={label}>Email</span><input name="email" defaultValue={lead.email ?? ""} className={input} /></label>
      <label><span className={label}>Negocio</span><input name="business_type" defaultValue={lead.business_type ?? ""} className={input} placeholder="bar, taller, clínica…" /></label>
      <label><span className={label}>Factura de luz al mes (€)</span><input name="monthly_bill" inputMode="decimal" defaultValue={n(lead.monthly_bill)} className={input} placeholder="ej. 180" /></label>
      <label><span className={label}>Provincia</span><input name="province" defaultValue={lead.province ?? ""} className={input} /></label>
      <label><span className={label}>Código postal</span><input name="postal_code" inputMode="numeric" defaultValue={lead.postal_code ?? ""} className={input} /></label>
      {vertical === "luz" ? (
        <>
          <label>
            <span className={label}>Tarifa (peaje)</span>
            <select name="tariff" defaultValue={lead.tariff ?? ""} className={input}>
              <option value="">—</option><option value="2.0TD">2.0TD (hasta 15 kW)</option><option value="3.0TD">3.0TD (más de 15 kW)</option><option value="6.1TD">6.1TD (alta tensión)</option>
            </select>
          </label>
          <label><span className={label}>Potencia contratada (kW)</span><input name="contracted_power_kw" inputMode="decimal" defaultValue={n(lead.contracted_power_kw)} className={input} /></label>
          <label><span className={label}>Comercializadora actual</span><input name="current_supplier" defaultValue={lead.current_supplier ?? ""} className={input} /></label>
          <input type="hidden" name="roof" value={lead.roof ?? ""} />
          <input type="hidden" name="daytime_share" value={n(lead.daytime_share)} />
        </>
      ) : (
        <>
          <label>
            <span className={label}>Cubierta</span>
            <select name="roof" defaultValue={lead.roof ?? ""} className={input}>
              <option value="">—</option><option value="propio">Propia (tejado, nave, terraza)</option><option value="comunidad">De la comunidad</option>
              <option value="alquiler">Local en alquiler</option><option value="no">No tiene</option>
            </select>
          </label>
          <label><span className={label}>% del consumo de día</span><input name="daytime_share" inputMode="numeric" defaultValue={n(lead.daytime_share)} className={input} placeholder="ej. 70" /></label>
          <label><span className={label}>Comercializadora actual</span><input name="current_supplier" defaultValue={lead.current_supplier ?? ""} className={input} /></label>
          <input type="hidden" name="tariff" value={lead.tariff ?? ""} />
          <input type="hidden" name="contracted_power_kw" value={n(lead.contracted_power_kw)} />
        </>
      )}
    </fieldset>
  );
}
