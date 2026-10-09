// Inicio: el grupo entero (o una empresa) de un vistazo, la cola de todas las líneas y la bandeja para operar sin entrar en cada ficha.
import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { currentMonth, eur, monthLabel, ago, nowMs, shortName, telHref } from "@/lib/format";
import { A, Card, ChipLink, Empty, Stat, StatusBadge, btn } from "@/components/ui";
import { IconBolt } from "@/components/Sidebar";
import { requireUser } from "@/lib/auth";
import { LEAD_STATUS } from "@/lib/labels";
import { statusMap } from "@/lib/lineas";
import { getLines } from "@/lib/services/lines";
import { groupOverview } from "@/lib/services/group";
import { GroupOverview } from "@/components/GroupOverview";
import { LineStatusSelect } from "@/components/Operativa";

export default async function Dashboard(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const user = await requireUser();
  const month = currentMonth();
  const [group, allLines] = await Promise.all([groupOverview(month), getLines()]);
  const companies = [...(group.parent ? [group.parent] : []), ...group.companies];
  const company = companies.find((c) => c.slug === sp.empresa) ?? null;
  const lines = company ? allLines.filter((l) => l.company_slug === company.slug) : allLines;
  const generic = lines.filter((l) => l.kind !== "despachos");
  const ids = generic.map((l) => l.id);
  const desp = lines.some((l) => l.kind === "despachos"); // Segunda Oportunidad (tablas de siempre) entra en las cifras
  const byId = new Map(allLines.map((l) => [l.id, l]));
  const despLine = allLines.find((l) => l.kind === "despachos");

  const [k] = await query<{
    cola: number; hoy: number; mes: number; contactados: number; con_intento: number; cierres: number; valor: number; speed: number | null; esperando: string | null;
  }>(
    `WITH day AS (SELECT date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' AS d),
          m AS (SELECT date_trunc('month', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid' AS d),
          ll AS (SELECT * FROM line_leads WHERE line_id = ANY($1::uuid[])),
          dl AS (SELECT * FROM leads WHERE $2 AND vertical = 'lso' AND status <> 'duplicado')
     SELECT
       ((SELECT count(*) FROM ll WHERE status IN ('nuevo','no_contesta') AND next_call_at <= now())
        + (SELECT count(*) FROM dl JOIN clients c ON c.id = dl.client_id WHERE c.status = 'activo' AND dl.status IN ('nuevo','no_contesta','volver_a_llamar')
             AND dl.qualification_status <> 'no_cualificado' AND dl.next_call_at <= now() AND dl.phone IS NOT NULL))::int cola,
       ((SELECT count(*) FROM ll, day WHERE created_at >= day.d) + (SELECT count(*) FROM dl, day WHERE created_at >= day.d))::int hoy,
       ((SELECT count(*) FROM ll, m WHERE created_at >= m.d) + (SELECT count(*) FROM dl, m WHERE created_at >= m.d))::int mes,
       ((SELECT count(*) FROM ll, m WHERE created_at >= m.d AND attempts > 0 AND first_contact_at IS NOT NULL) + (SELECT count(*) FROM dl, m WHERE created_at >= m.d AND attempts > 0 AND first_contact_at IS NOT NULL))::int contactados,
       ((SELECT count(*) FROM ll, m WHERE created_at >= m.d AND attempts > 0) + (SELECT count(*) FROM dl, m WHERE created_at >= m.d AND attempts > 0))::int con_intento,
       ((SELECT count(*) FROM ll, m WHERE won_at >= m.d)
        + (SELECT count(*) FROM consultations co, m WHERE $2 AND co.scheduled_at >= m.d AND co.status = 'asistida'))::int cierres,
       coalesce((SELECT sum(value) FROM ll, m WHERE won_at >= m.d), 0)::float valor,
       (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY mins) FROM (
          SELECT extract(epoch FROM (first_contact_at - created_at)) / 60 mins FROM ll, m WHERE created_at >= m.d AND first_contact_at IS NOT NULL
          UNION ALL
          SELECT extract(epoch FROM (c.created_at - dl.created_at)) / 60 FROM dl JOIN LATERAL (SELECT created_at FROM calls WHERE lead_id = dl.id ORDER BY created_at LIMIT 1) c ON true, m
           WHERE dl.created_at >= m.d) s) speed,
       (SELECT min(created_at) FROM (
          SELECT created_at FROM ll WHERE status = 'nuevo' AND attempts = 0
          UNION ALL
          SELECT dl.created_at FROM dl JOIN clients c ON c.id = dl.client_id WHERE c.status = 'activo' AND dl.status = 'nuevo' AND dl.attempts = 0
            AND dl.qualification_status <> 'no_cualificado' AND dl.phone IS NOT NULL) w)::text esperando`,
    [ids, desp],
  );

  // Bandeja: los últimos leads de todas las líneas (o de la empresa elegida)
  const inbox = await query<{ kind: "linea" | "despacho"; id: string; line_id: string | null; full_name: string; phone: string | null; status: string; priority: string | null; created_at: string }>(
    `(SELECT 'linea' kind, id, line_id, full_name, phone, status, priority, created_at FROM line_leads WHERE line_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 12)
     UNION ALL
     (SELECT 'despacho', id, NULL, full_name, phone, status, NULL, created_at FROM leads WHERE $2 AND vertical = 'lso' AND status <> 'duplicado' ORDER BY created_at DESC LIMIT 12)
     ORDER BY created_at DESC LIMIT 12`,
    [ids, desp],
  );

  // Pendientes: lo que se está quedando atrás
  const [p] = await query<{ sin_llamar: number; rellamadas: number; propuestas: number }>(
    `SELECT count(*) FILTER (WHERE status = 'nuevo' AND attempts = 0 AND created_at < now() - interval '5 minutes')::int sin_llamar,
            count(*) FILTER (WHERE status = 'no_contesta' AND next_call_at <= now())::int rellamadas,
            count(*) FILTER (WHERE status = 'propuesta' AND updated_at < now() - interval '7 days')::int propuestas
       FROM line_leads WHERE line_id = ANY($1::uuid[])`,
    [ids],
  );
  const audits = await query<{ kind: string; id: string; name: string; total: number; done: number; plan: boolean }>(
    `SELECT 'linea' kind, lc.id, lc.name, jsonb_array_length(bl.audit_items)::int total,
            (SELECT count(*) FROM client_audits a WHERE a.client_kind = 'linea' AND a.client_id = lc.id AND a.month = $2 AND a.done)::int done,
            EXISTS (SELECT 1 FROM client_ai ai WHERE ai.client_kind = 'linea' AND ai.client_id = lc.id AND ai.plan IS NOT NULL) plan
       FROM line_clients lc JOIN business_lines bl ON bl.id = lc.line_id WHERE lc.status = 'activo' AND lc.line_id = ANY($1::uuid[])
     UNION ALL
     SELECT 'despacho', c.id, c.name, coalesce((SELECT jsonb_array_length(audit_items) FROM business_lines WHERE kind = 'despachos' LIMIT 1), 0)::int,
            (SELECT count(*) FROM client_audits a WHERE a.client_kind = 'despacho' AND a.client_id = c.id AND a.month = $2 AND a.done)::int,
            EXISTS (SELECT 1 FROM client_ai ai WHERE ai.client_kind = 'despacho' AND ai.client_id = c.id AND ai.plan IS NOT NULL)
       FROM clients c WHERE $3 AND c.vertical = 'lso' AND c.status = 'activo'`,
    [ids, month, desp],
  );
  const lowAudit = audits.filter((a) => a.total > 0 && a.done / a.total < 0.5);
  const noPlan = audits.filter((a) => !a.plan);
  const lastLead = await queryOne<{ at: string | null }>(
    "SELECT greatest((SELECT max(created_at) FROM line_leads WHERE line_id = ANY($1::uuid[])), (SELECT max(created_at) FROM leads WHERE $2 AND vertical = 'lso'))::text at",
    [ids, desp],
  );

  const hour = Number(new Date(nowMs()).toLocaleString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }));
  const greet = hour < 6 ? "Buenas noches" : hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  const waitMin = k.esperando ? Math.floor((nowMs() - new Date(k.esperando).getTime()) / 60000) : null;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
  const q = company ? `empresa=${company.slug}` : "";
  // Cazar: con Segunda Oportunidad dentro, la cola general (con su pestaña de otras líneas); si no, la de la línea o la de todas
  const hunt = desp ? "/cola" : generic.length === 1 ? `/lineas/cola?linea=${generic[0].slug}` : "/lineas/cola";
  const clientHref = (a: { kind: string; id: string }) => (a.kind === "linea" ? `/clientes/l/${a.id}` : `/clientes/${a.id}`);
  const todo = [
    { n: p.sin_llamar, label: "leads nuevos sin llamar (más de 5 min)", href: `/lineas?status=nuevo${q ? `&${q}` : ""}`, tone: "bad" },
    { n: p.rellamadas, label: "rellamadas vencidas", href: `/lineas?status=no_contesta${q ? `&${q}` : ""}` },
    { n: p.propuestas, label: "propuestas sin mover en 7 días", href: `/lineas?status=propuesta&vista=tablero${q ? `&${q}` : ""}` },
    { n: lowAudit.length, label: `clientes con la auditoría de ${monthLabel(month).split(" ")[0]} por debajo del 50 %`, href: lowAudit[0] ? clientHref(lowAudit[0]) : "/clientes" },
    { n: noPlan.length, label: "clientes sin plan de la IA", href: noPlan[0] ? clientHref(noPlan[0]) : "/clientes" },
  ].filter((t) => t.n > 0);

  return (
    <>
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="text-blaze">{group.parent?.name ?? "Leads Hunters"} · matriz</span>{company && !company.is_parent ? ` › ${company.name}` : ""} · {monthLabel(month)} · último lead {ago(lastLead?.at)}
        </div>
        <h1 className="font-display mt-1 text-[1.6rem] font-semibold leading-tight sm:text-3xl">{greet}, {shortName(user.name)}</h1>
      </div>

      {/* Filtro por empresa: todo Inicio se recalcula */}
      <nav aria-label="Filtrar por empresa" className="lh-rail -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ChipLink href="/" active={!company}>🎯 Todo el grupo</ChipLink>
        {companies.map((c) => (
          <ChipLink key={c.id} href={`/?empresa=${c.slug}`} active={company?.id === c.id}>{c.emoji} {c.is_parent ? "Ramas propias" : c.name}</ChipLink>
        ))}
      </nav>

      {!company && <GroupOverview parent={group.parent} companies={group.companies} total={group.total} monthName={monthLabel(month).split(" ")[0]} />}

      {company && (
        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paper text-2xl">{company.emoji}</span>
            <div className="min-w-0">
              <div className="font-display text-xl font-semibold">{company.is_parent ? `${company.name} · ramas propias` : company.name}</div>
              <div className="truncate text-xs text-slate-500">{company.tagline ?? "Empresa del grupo"} · {company.lines.map((l) => `${l.emoji} ${l.name}`).join(", ") || "sin líneas"}</div>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-5 text-right">
            <div><dt className="text-[11px] text-slate-500">Leads mes</dt><dd className="num text-lg font-semibold">{company.leads_mes}</dd></div>
            <div><dt className="text-[11px] text-slate-500">Clientes</dt><dd className="num text-lg font-semibold">{company.clientes}</dd></div>
            <div><dt className="text-[11px] text-slate-500">Factura</dt><dd className="num text-lg font-semibold text-emerald-700">{eur(company.facturacion_mes)}</dd></div>
          </dl>
          <div className="flex w-full flex-wrap gap-2">
            <Link href={`/captar?empresa=${company.slug}`} className={btn.secondary}>Captar clientes</Link>
            <Link href={`/lineas?${q}`} className={btn.secondary}>Sus leads</Link>
            <Link href="/clientes" className={btn.secondary}>Sus clientes</Link>
          </div>
        </section>
      )}

      {/* Lo urgente: la cola de todas las líneas */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white sm:p-7">
        <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-14 -top-14 size-64 opacity-[0.13]" aria-hidden>
          <circle cx="100" cy="100" r="96" fill="none" stroke="#ff5b1a" strokeWidth="2" />
          <circle cx="100" cy="100" r="64" fill="none" stroke="#ff5b1a" strokeWidth="2" />
          <circle cx="100" cy="100" r="32" fill="none" stroke="#ff5b1a" strokeWidth="2" />
          <path d="M100 0v200M0 100h200" stroke="#ff5b1a" strokeWidth="2" />
        </svg>
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">En la mira ahora · {company ? company.name : "todas las líneas"}</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="num text-6xl font-semibold leading-none text-blaze sm:text-7xl">{k.cola}</span>
              <span className="text-base text-white/80">{k.cola === 1 ? "persona esperando tu llamada" : "personas esperando tu llamada"}</span>
            </div>
            <p className="mt-3 max-w-md text-sm text-white/60">
              {waitMin == null
                ? "No hay leads nuevos sin llamar. Buen trabajo."
                : waitMin <= 5
                  ? `El lead más antiguo entró hace ${waitMin} min. Aún estás dentro de los 5 minutos de oro.`
                  : `El lead nuevo más antiguo lleva ${ago(k.esperando).replace("hace ", "")} esperando. Cada minuto baja la probabilidad de contactar.`}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link href={hunt} className={`${btn.hunt} min-h-13 px-6 text-base`}><IconBolt className="size-5" /> Cazar el siguiente</Link>
            <Link href={`/lineas?vista=tablero${q ? `&${q}` : ""}`} className={`${btn.base} bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15`}>▦ Abrir tablero</Link>
          </div>
        </div>
      </section>

      <div className="lh-rail -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        <Stat label="Leads hoy" value={k.hoy} hint={`${k.mes} este mes`} />
        <Stat
          label="Velocidad"
          value={k.speed == null ? "—" : k.speed < 60 ? `${Math.round(k.speed)}′` : `${(k.speed / 60).toFixed(1)} h`}
          hint="Mediana hasta el 1er contacto · objetivo < 5′"
          tone={k.speed != null && k.speed <= 5 ? "good" : k.speed != null && k.speed > 30 ? "bad" : undefined}
        />
        <Stat label="Tasa de contacto" value={pct(k.contactados, k.con_intento)} hint="De los leads a los que has llamado" />
        <Stat label="Cierres del mes" value={k.cierres} hint={k.valor ? `${eur(k.valor)} en ventas de las líneas` : "Ventas, altas y consultas realizadas"} tone="good" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Bandeja · últimos leads" actions={<A href={`/lineas${q ? `?${q}` : ""}`} className="text-xs">Ver todos</A>} flush>
            {inbox.length === 0 ? <div className="p-4"><Empty>Todavía no han entrado leads{company ? ` en ${company.name}` : ""}.</Empty></div> : (
              <ul className="divide-y divide-slate-100">
                {inbox.map((r) => {
                  const l = r.line_id ? byId.get(r.line_id) : despLine;
                  return (
                    <li key={`${r.kind}-${r.id}`} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper text-lg" title={l?.name}>{l?.emoji ?? "•"}</span>
                      <span className="min-w-0 flex-1">
                        <Link href={r.kind === "linea" ? `/lineas/${r.id}` : `/leads/${r.id}`} className="block truncate font-semibold hover:underline">{r.full_name}</Link>
                        <span className="block truncate text-xs text-slate-500">{l ? `${l.name} · ${l.company_name}` : ""} · {ago(r.created_at)}{r.priority ? ` · ${r.priority}` : ""}</span>
                      </span>
                      {r.phone && <a href={telHref(r.phone)} className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 hover:bg-slate-200" aria-label={`Llamar a ${r.full_name}`}>📞</a>}
                      <span className="flex w-36 shrink-0 justify-end [&>select]:w-full">
                        {r.kind === "linea" ? <LineStatusSelect id={r.id} value={r.status} map={statusMap(l)} /> : <StatusBadge map={LEAD_STATUS} value={r.status} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Pendientes">
          {todo.length === 0 ? <Empty>Todo al día. No hay nada atascado.</Empty> : (
            <ul className="-my-1 divide-y divide-slate-100">
              {todo.map((t) => (
                <li key={t.label}>
                  <Link href={t.href} className="flex items-center gap-3 py-2.5">
                    <span className={`num grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold ${t.tone === "bad" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-900"}`}>{t.n}</span>
                    <span className="min-w-0 flex-1 text-sm">{t.label}</span>
                    <span className="text-slate-300">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
            <Link href={`/lineas/nuevo`} className={`${btn.secondary} text-xs`}>+ Lead</Link>
            <Link href="/clientes#nuevo" className={`${btn.secondary} text-xs`}>+ Cliente</Link>
          </div>
        </Card>
      </div>
    </>
  );
}
