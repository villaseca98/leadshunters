// Leads de las demás empresas y líneas (Recorta luz, placas…). Llegan por Instagram (ManyChat) a POST /api/v1/particulares con "linea".
import Link from "next/link";
import { query } from "@/lib/db";
import { statusMap } from "@/lib/lineas";
import { getLines } from "@/lib/services/lines";
import { ago, eur } from "@/lib/format";
import { VerticalTabs } from "@/components/VerticalTabs";
import { A, Card, ChipLink, Empty, Filters, PageHeader, Pager, Stat, btn, input } from "@/components/ui";
import { LineLeadsWorkspace, type LeadRow } from "@/components/Operativa";

const PER_PAGE = 50;

export default async function Lineas(props: PageProps<"/lineas">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const lines = await getLines({ includeDespachos: false });
  const line = lines.find((l) => l.slug === str("linea")) ?? null;
  const webLeads = line ? (await query<{ n: number }>("SELECT count(*)::int n FROM leads WHERE vertical = $1", [line.slug]))[0]?.n ?? 0 : 0;
  const companies = Array.from(new Map(lines.map((l) => [l.company_slug, l.company_name])).entries());
  const empresa = companies.some(([s]) => s === str("empresa")) ? str("empresa") : "";
  const q = str("q"), status = str("status"), priority = str("prioridad"), canal = str("canal");
  const page = Math.max(1, Number(str("page") || 1));
  const view = str("vista") === "tablero" ? "tablero" : "lista";
  const perPage = view === "tablero" ? 300 : PER_PAGE;
  const where: string[] = ["bl.kind <> 'despachos'"];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll("?", `$${params.length}`)); };
  if (line) add("ll.line_id = ?", line.id);
  if (empresa) add("c.slug = ?", empresa);
  if (q) add("(ll.full_name ILIKE ? OR ll.phone ILIKE ? OR ll.email ILIKE ?)", `%${q}%`);
  if (status === "abiertos") where.push("ll.status IN ('nuevo','no_contesta','contactado','propuesta')");
  else if (status) add("ll.status = ?", status);
  if (priority) add("ll.priority = ?", priority);
  if (canal) add("ll.channel = ?", canal);
  if (/^[0-9a-f-]{36}$/.test(str("cliente"))) add("ll.client_id = ?", str("cliente"));
  const w = `FROM line_leads ll JOIN business_lines bl ON bl.id = ll.line_id JOIN companies c ON c.id = bl.company_id WHERE ${where.join(" AND ")}`;

  const [{ total }] = await query<{ total: number }>(`SELECT count(*)::int total ${w}`, params);
  const rows = await query<{
    id: string; line_slug: string; full_name: string; phone: string; province: string | null; priority: string; priority_reasons: string[];
    status: string; channel: string; campaign: string | null; value: number | null; created_at: string; next_call_at: string; client_id: string | null;
  }>(
    `SELECT ll.id, bl.slug AS line_slug, ll.full_name, ll.phone, ll.province, ll.priority, ll.priority_reasons, ll.status, ll.channel,
            ll.campaign, ll.value, ll.created_at, ll.next_call_at, ll.client_id
       ${w} ORDER BY (ll.status = 'nuevo') DESC, ll.priority, ll.created_at DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
    params,
  );
  const [k] = await query<{ mes: number; en_cola: number; ganados_mes: number; valor_mes: number | null }>(
    `SELECT count(*) FILTER (WHERE ll.created_at >= date_trunc('month', now()))::int mes,
            count(*) FILTER (WHERE ll.status IN ('nuevo','no_contesta') AND ll.next_call_at <= now())::int en_cola,
            count(*) FILTER (WHERE ll.won_at >= date_trunc('month', now()))::int ganados_mes,
            sum(ll.value) FILTER (WHERE ll.won_at >= date_trunc('month', now())) valor_mes
       FROM line_leads ll JOIN business_lines bl ON bl.id = ll.line_id JOIN companies c ON c.id = bl.company_id
      WHERE ($1::uuid IS NULL OR ll.line_id = $1) AND ($2::text = '' OR c.slug = $2)`,
    [line?.id ?? null, empresa],
  );
  const canales = await query<{ channel: string }>("SELECT DISTINCT channel FROM line_leads ORDER BY 1");
  const clients = await query<{ id: string; name: string; line_id: string }>("SELECT id, name, line_id FROM line_clients WHERE status <> 'baja' ORDER BY name");
  const bySlug = Object.fromEntries(lines.map((l) => [l.slug, l]));
  const href = (p: number) => {
    const u = new URLSearchParams(Object.entries({ linea: line?.slug ?? "", empresa, q, status, prioridad: priority, canal, vista: view === "tablero" ? "tablero" : "" }).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `/lineas?${u}`;
  };
  const viewHref = (v: string) => {
    const u = new URLSearchParams(Object.entries({ linea: line?.slug ?? "", empresa, q, status, prioridad: priority, canal, vista: v === "tablero" ? "tablero" : "" }).filter(([, x]) => x) as [string, string][]);
    return `/lineas${u.size ? `?${u}` : ""}`;
  };
  const maps = Object.fromEntries([["", statusMap(line ?? undefined)], ...lines.map((l) => [l.id, statusMap(l)])]);
  const leadRows: LeadRow[] = rows.map((r) => {
    const l = bySlug[r.line_slug];
    return {
      id: r.id, full_name: r.full_name, phone: r.phone, province: r.province, line_id: l?.id ?? "", line_label: l ? `${l.emoji} ${l.name}` : r.line_slug,
      company: l?.company_name ?? "", priority: r.priority, reasons: r.priority_reasons.slice(0, 2).join(" · ").replace(/ \([+-]\d+\)/g, ""),
      status: r.status, channel: r.channel, campaign: r.campaign, value: r.value, entered: ago(r.created_at), client_id: r.client_id,
    };
  });
  const imported = str("importados");

  return (
    <>
      <PageHeader
        title={line ? `${line.emoji} ${line.name}` : "Leads de las líneas"}
        eyebrow={line ? line.company_name : "Todas las empresas del grupo"}
        subtitle={`${total} leads con consentimiento. Llama primero a los nuevos de prioridad A.`}
        actions={
          <>
            <Link href={`/lineas/cola${line ? `?linea=${line.slug}` : ""}`} className={btn.hunt}>Cazar el siguiente</Link>
            <Link href={`/lineas/nuevo${line ? `?linea=${line.slug}` : ""}`} className={btn.primary}>+ Lead manual</Link>
            <a href={`/api/export/lineas${line ? `?linea=${line.slug}` : ""}`} className={btn.secondary}>CSV</a>
          </>
        }
      />
      <VerticalTabs active={line?.slug ?? "todas"} />
      {line && webLeads > 0 && (
        <p className="-mt-2 mb-4 text-sm text-slate-600">
          Además hay <A href={`/leads?vertical=${line.slug}`}>{webLeads} leads de {line.name.toLowerCase()} de la web de Recorta</A>, que van por oportunidades.
        </p>
      )}
      {imported && (
        <Card className="mb-4"><p className="text-sm">Importados {imported} · ya estaban {str("repetidos")} · con errores {str("errores")} (teléfono o nombre que faltan).</p></Card>
      )}
      <div className="lh-rail -mx-4 mb-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
        <Stat label="Para llamar ya" value={k.en_cola} tone={k.en_cola > 0 ? "bad" : undefined} hint="Nuevos y rellamadas" />
        <Stat label="Entrados este mes" value={k.mes} />
        <Stat label={`${line?.won_label ?? "Cierres"} este mes`} value={k.ganados_mes} tone="good" />
        <Stat label={`${line?.value_label ?? "Ingresos"} del mes`} value={eur(k.valor_mes ?? 0)} tone="good" />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-slate-200" role="tablist" aria-label="Vista">
          <ChipLink href={viewHref("lista")} active={view === "lista"}>☰ Lista</ChipLink>
          <ChipLink href={viewHref("tablero")} active={view === "tablero"}>▦ Tablero</ChipLink>
        </div>
        <p className="text-xs text-slate-500">{view === "tablero" ? "Arrastra cada tarjeta a su nuevo estado." : "Cambia el estado en la propia fila o marca varios para cambiarlos de golpe."}</p>
      </div>
      <Filters active={[q, status, priority, canal, empresa].filter(Boolean).length}>
        <form className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {line && <input type="hidden" name="linea" value={line.slug} />}
          {view === "tablero" && <input type="hidden" name="vista" value="tablero" />}
          <input name="q" defaultValue={q} placeholder="Nombre, teléfono, email…" className={`${input} col-span-2`} />
          {!line && companies.length > 1 && (
            <select name="empresa" defaultValue={empresa} className={input}>
              <option value="">Empresa: todas</option>
              {companies.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
            </select>
          )}
          <select name="status" defaultValue={status} className={input}>
            <option value="">Estado: todos</option>
            <option value="abiertos">Abiertos (sin cerrar)</option>
            {Object.entries(statusMap(line ?? undefined)).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
          </select>
          <select name="prioridad" defaultValue={priority} className={input}>
            <option value="">Prioridad: todas</option>
            {["A", "B", "C"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex gap-2">
            <select name="canal" defaultValue={canal} className={input}>
              <option value="">Canal: todos</option>
              {canales.map((c) => <option key={c.channel} value={c.channel}>{c.channel}</option>)}
            </select>
            <button className={btn.secondary}>Filtrar</button>
          </div>
        </form>
      </Filters>
      {rows.length === 0 ? (
        <Empty>
          Todavía no hay leads aquí. Conecta ManyChat con el cuerpo que verás en <A href={line ? `/negocios/${line.id}` : "/negocios"}>Grupo y empresas</A>
          {" "}o <A href="/lineas/importar">importa contactos antiguos</A>.
        </Empty>
      ) : (
        <LineLeadsWorkspace rows={leadRows} view={view} maps={maps} clients={clients} showLine={!line} valueLabel={line?.value_label ?? "Importe"} />
      )}
      <Pager page={page} pages={Math.ceil(total / perPage)} makeHref={href} />
      <p className="mt-4 text-xs text-slate-500"><A href="/lineas/importar">Importar contactos antiguos (reactivación)</A></p>
    </>
  );
}
