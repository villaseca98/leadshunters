import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { billingForMonth } from "@/lib/services/billing";
import { currentMonth, dateTime, eur, monthLabel, ago, nowMs, shortName } from "@/lib/format";
import { A, Card, Empty, ScorePill, Stat, StatusBadge, btn } from "@/components/ui";
import { IconBolt } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { CONSULTATION_STATUS, PROSPECT_STATUS } from "@/lib/labels";

export default async function Dashboard() {
  const user = await requireUser();
  const month = currentMonth();
  const [kpi] = await query<{
    leads_hoy: number; leads_mes: number; cualif_mes: number; citas_mes: number; asistidas_mes: number;
    en_cola: number; speed_min: number | null; contact_rate: number | null;
  }>(
    `WITH m AS (SELECT date_trunc('month', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' AS start)
     SELECT
       (SELECT count(*) FROM leads WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' AND status <> 'duplicado')::int AS leads_hoy,
       (SELECT count(*) FROM leads, m WHERE created_at >= m.start AND status <> 'duplicado')::int AS leads_mes,
       (SELECT count(*) FROM leads, m WHERE created_at >= m.start AND qualification_status = 'cualificado')::int AS cualif_mes,
       (SELECT count(*) FROM consultations, m WHERE created_at >= m.start AND status <> 'cancelada')::int AS citas_mes,
       (SELECT count(*) FROM consultations, m WHERE scheduled_at >= m.start AND status = 'asistida')::int AS asistidas_mes,
       (SELECT count(*) FROM leads l JOIN clients c ON c.id = l.client_id WHERE c.status='activo' AND l.status IN ('nuevo','no_contesta','volver_a_llamar') AND l.qualification_status <> 'no_cualificado' AND l.next_call_at <= now() AND l.phone IS NOT NULL)::int AS en_cola,
       (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (c.created_at - l.created_at)) / 60)
          FROM leads l JOIN LATERAL (SELECT created_at FROM calls WHERE lead_id = l.id ORDER BY created_at LIMIT 1) c ON true, m
         WHERE l.created_at >= m.start) AS speed_min,
       (SELECT avg(CASE WHEN first_contact_at IS NOT NULL THEN 1.0 ELSE 0 END) FROM leads, m WHERE created_at >= m.start AND attempts > 0) AS contact_rate`,
  );
  const billing = await billingForMonth(month);
  const mrr = billing.reduce((a, b) => a + b.total, 0);

  const pipeline = await query<{ status: string; n: number }>("SELECT status, count(*)::int AS n FROM prospects GROUP BY status");
  const pmap = Object.fromEntries(pipeline.map((p) => [p.status, p.n]));
  const topProspects = await query<{ id: string; name: string; city: string | null; score: number; score_tier: string; status: string }>(
    "SELECT id, name, city, score, score_tier, status FROM prospects WHERE status IN ('nuevo','a_llamar','no_contesta') AND phone IS NOT NULL ORDER BY score DESC LIMIT 6",
  );
  const upcoming = await query<{ id: string; scheduled_at: string; status: string; full_name: string; cliente: string }>(
    `SELECT co.id, co.scheduled_at, co.status, l.full_name, c.name AS cliente FROM consultations co
       JOIN leads l ON l.id = co.lead_id JOIN clients c ON c.id = co.client_id
      WHERE co.status = 'agendada' ORDER BY co.scheduled_at LIMIT 6`,
  );
  const lastLead = await queryOne<{ created_at: string }>("SELECT created_at FROM leads ORDER BY created_at DESC LIMIT 1");
  const oldestWaiting = await queryOne<{ created_at: string }>(
    `SELECT l.created_at FROM leads l JOIN clients c ON c.id = l.client_id
      WHERE c.status = 'activo' AND l.status = 'nuevo' AND l.attempts = 0 AND l.qualification_status <> 'no_cualificado'
        AND l.phone IS NOT NULL ORDER BY l.created_at LIMIT 1`,
  );

  const conv = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
  const hour = Number(new Date(nowMs()).toLocaleString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));
  const greet = hour < 6 ? "Buenas noches" : hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  const waitMin = oldestWaiting ? Math.floor((nowMs() - new Date(oldestWaiting.created_at).getTime()) / 60000) : null;
  const funnel = ["nuevo", "a_llamar", "no_contesta", "contactado", "interesado", "reunion", "propuesta", "cliente"];
  const funnelTotal = funnel.reduce((a, k) => a + (pmap[k] ?? 0), 0) || 1;
  const funnelColor: Record<string, string> = {
    nuevo: "#c2c6b7", a_llamar: "#959a8b", no_contesta: "#e8a317", contactado: "#ff9a6b", interesado: "#ff7a3f",
    reunion: "#ff5b1a", propuesta: "#b83808", cliente: "#1f6b45",
  };

  return (
    <>
      <div className="mb-4 sm:mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{monthLabel(month)} · último lead {ago(lastLead?.created_at)}</div>
        <h1 className="font-display mt-1 text-[1.6rem] font-semibold leading-tight sm:text-3xl">{greet}, {shortName(user.name)}</h1>
      </div>

      {/* Lo urgente primero: la cola */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white sm:p-7">
        <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-14 -top-14 size-64 opacity-[0.13]" aria-hidden>
          <circle cx="100" cy="100" r="96" fill="none" stroke="#ff5b1a" strokeWidth="2" />
          <circle cx="100" cy="100" r="64" fill="none" stroke="#ff5b1a" strokeWidth="2" />
          <circle cx="100" cy="100" r="32" fill="none" stroke="#ff5b1a" strokeWidth="2" />
          <path d="M100 0v200M0 100h200" stroke="#ff5b1a" strokeWidth="2" />
        </svg>
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">En la mira ahora</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="num text-6xl font-semibold leading-none text-blaze sm:text-7xl">{kpi.en_cola}</span>
              <span className="text-base text-white/80">{kpi.en_cola === 1 ? "persona esperando tu llamada" : "personas esperando tu llamada"}</span>
            </div>
            <p className="mt-3 max-w-md text-sm text-white/60">
              {waitMin == null
                ? "No hay leads nuevos sin llamar. Buen trabajo."
                : waitMin <= 5
                  ? `El lead más antiguo entró hace ${waitMin} min. Aún estás dentro de los 5 minutos de oro.`
                  : `El lead nuevo más antiguo lleva ${waitMin < 120 ? `${waitMin} min` : ago(oldestWaiting!.created_at).replace("hace ", "")} esperando. Cada minuto baja la probabilidad de contactar.`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link href="/cola" className={`${btn.hunt} min-h-13 px-6 text-base`}><IconBolt className="size-5" /> Cazar el siguiente</Link>
            <Link href="/prospeccion/llamar" className={`${btn.base} bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15`}>Llamar despachos</Link>
          </div>
        </div>
      </section>

      {/* KPIs: carril deslizable en móvil, rejilla en ordenador */}
      <div className="lh-rail -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        <Stat label="Facturación del mes" value={eur(mrr)} hint={`${billing.filter((b) => b.status === "activo").length} clientes activos`} tone="good" />
        <Stat label="Consultas realizadas" value={kpi.asistidas_mes} hint="Facturables este mes" tone="good" />
        <Stat
          label="Velocidad"
          value={kpi.speed_min == null ? "—" : kpi.speed_min < 60 ? `${Math.round(kpi.speed_min)}′` : `${(kpi.speed_min / 60).toFixed(1)} h`}
          hint="Mediana hasta la 1ª llamada · objetivo < 5′"
          tone={kpi.speed_min != null && kpi.speed_min <= 5 ? "good" : kpi.speed_min != null && kpi.speed_min > 30 ? "bad" : undefined}
        />
        <Stat label="Leads hoy" value={kpi.leads_hoy} hint={`${kpi.leads_mes} este mes`} />
        <Stat label="Cualificados" value={kpi.cualif_mes} hint={`${conv(kpi.cualif_mes, kpi.leads_mes)} de los leads`} />
        <Stat label="Consultas agendadas" value={kpi.citas_mes} hint="Este mes" />
        <Stat label="Tasa de contacto" value={kpi.contact_rate == null ? "—" : `${Math.round(kpi.contact_rate * 100)} %`} hint="Leads que contestaron" />
        <Stat label="Clientes" value={pmap.cliente ?? 0} hint="Despachos que pagan" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Próximas consultas" actions={<A href="/citas" className="text-xs">Agenda</A>}>
          {upcoming.length ? (
            <ol className="relative space-y-4 border-l-2 border-slate-200 pl-4">
              {upcoming.map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-blaze ring-4 ring-white" />
                  <div className="text-xs font-medium text-slate-500">{dateTime(c.scheduled_at)}</div>
                  <div className="truncate font-semibold">{c.full_name}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-500">{c.cliente}</span>
                    <StatusBadge map={CONSULTATION_STATUS} value={c.status} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Sin consultas agendadas.</Empty>
          )}
        </Card>

        <Card title="Despachos para llamar hoy" actions={<A href="/prospeccion/llamar" className="text-xs">Empezar</A>}>
          {topProspects.length ? (
            <ul className="-my-1 divide-y divide-slate-100">
              {topProspects.map((p) => (
                <li key={p.id}>
                  <Link href={`/prospeccion/${p.id}`} className="flex items-center gap-3 py-2.5">
                    <ScorePill score={p.score} tier={p.score_tier} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="block text-xs text-slate-500">{p.city ?? "—"}</span>
                    </span>
                    <span className="text-slate-300">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aún no hay despachos. Lanza el flujo de n8n de prospección o importa un CSV.</Empty>
          )}
        </Card>

        <Card title="Embudo de venta a despachos" actions={<A href="/prospeccion" className="text-xs">Ver todos</A>}>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {funnel.map((k) => (pmap[k] ? <span key={k} style={{ width: `${((pmap[k] ?? 0) / funnelTotal) * 100}%`, background: funnelColor[k] }} /> : null))}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {funnel.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: funnelColor[k] }} />
                <span className="flex-1 truncate text-slate-600">{PROSPECT_STATUS[k].label}</span>
                <span className="num font-semibold">{pmap[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
