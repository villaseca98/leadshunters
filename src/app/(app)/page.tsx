import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { billingForMonth } from "@/lib/services/billing";
import { currentMonth, dateTime, eur, monthLabel, ago } from "@/lib/format";
import { A, Badge, Card, Empty, PageHeader, Stat, StatusBadge, btn } from "@/components/ui";
import { CONSULTATION_STATUS, PROSPECT_STATUS } from "@/lib/labels";

export default async function Dashboard() {
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

  const conv = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

  return (
    <>
      <PageHeader
        title="Resumen"
        subtitle={`${monthLabel(month)} · último lead ${ago(lastLead?.created_at)}`}
        actions={
          <>
            <Link href="/cola" className={btn.primary}>⚡ Abrir cola ({kpi.en_cola})</Link>
            <Link href="/prospeccion/llamar" className={btn.secondary}>☏ Llamar despachos</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Leads hoy" value={kpi.leads_hoy} hint={`${kpi.leads_mes} este mes`} />
        <Stat label="Cualificados" value={kpi.cualif_mes} hint={`${conv(kpi.cualif_mes, kpi.leads_mes)} de los leads`} />
        <Stat label="Consultas agendadas" value={kpi.citas_mes} hint={`${conv(kpi.citas_mes, kpi.cualif_mes)} de cualificados`} />
        <Stat label="Consultas realizadas" value={kpi.asistidas_mes} hint="Facturables este mes" tone="good" />
        <Stat
          label="Velocidad de contacto"
          value={kpi.speed_min == null ? "—" : kpi.speed_min < 60 ? `${Math.round(kpi.speed_min)} min` : `${(kpi.speed_min / 60).toFixed(1)} h`}
          hint="Mediana hasta la 1ª llamada (objetivo < 5 min)"
          tone={kpi.speed_min != null && kpi.speed_min <= 5 ? "good" : kpi.speed_min != null && kpi.speed_min > 30 ? "bad" : undefined}
        />
        <Stat label="Tasa de contacto" value={kpi.contact_rate == null ? "—" : `${Math.round(kpi.contact_rate * 100)} %`} hint="Leads llamados que contestaron" />
        <Stat label="En cola ahora" value={kpi.en_cola} hint="Listos para llamar" tone={kpi.en_cola > 10 ? "bad" : undefined} />
        <Stat label="Facturación del mes" value={eur(mrr)} hint={`${billing.filter((b) => b.status === "activo").length} clientes activos`} tone="good" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Embudo de despachos (venta)" actions={<A href="/prospeccion" className="text-xs">Ver todos</A>}>
          <ul className="space-y-2 text-sm">
            {Object.entries(PROSPECT_STATUS).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between">
                <StatusBadge map={PROSPECT_STATUS} value={k} />
                <span className="tabular-nums font-medium text-slate-700">{pmap[k] ?? 0}</span>
                <span className="sr-only">{v.label}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Mejores despachos para llamar" actions={<A href="/prospeccion/llamar" className="text-xs">Empezar</A>}>
          {topProspects.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {topProspects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <A href={`/prospeccion/${p.id}`} className="block truncate">{p.name}</A>
                    <div className="text-xs text-slate-500">{p.city ?? "—"}</div>
                  </div>
                  <Badge tone={p.score_tier === "A" ? "emerald" : p.score_tier === "B" ? "amber" : "slate"}>
                    {p.score_tier} · {p.score}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aún no hay despachos. Lanza el flujo de n8n de prospección o importa un CSV.</Empty>
          )}
        </Card>

        <Card title="Próximas consultas" actions={<A href="/citas" className="text-xs">Agenda</A>}>
          {upcoming.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {upcoming.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{c.full_name}</div>
                    <div className="truncate text-xs text-slate-500">{c.cliente}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-600">{dateTime(c.scheduled_at)}</div>
                    <StatusBadge map={CONSULTATION_STATUS} value={c.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Sin consultas agendadas.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}
