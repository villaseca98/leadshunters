// Leads de luz y placas (afiliación Recorta). Llegan por Instagram (ManyChat) a POST /api/v1/particulares con "linea".
import Link from "next/link";
import { query } from "@/lib/db";
import { ENERGY_STATUS, PRIORITY, PROPERTY, VERTICALS } from "@/lib/energia";
import { ago, eur, telHref } from "@/lib/format";
import { VerticalTabs } from "@/components/VerticalTabs";
import { A, Empty, Filters, PageHeader, Pager, Stat, StatusBadge, Table, Td, btn, input } from "@/components/ui";

const PER_PAGE = 50;

export default async function Energia(props: PageProps<"/energia">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const linea = ["luz", "placas"].includes(str("linea")) ? str("linea") : "";
  const q = str("q"), status = str("status"), priority = str("prioridad"), canal = str("canal");
  const page = Math.max(1, Number(str("page") || 1));
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll("?", `$${params.length}`)); };
  if (linea) add("e.vertical = ?", linea);
  if (q) add("(e.full_name ILIKE ? OR e.phone ILIKE ? OR e.email ILIKE ?)", `%${q}%`);
  if (status === "abiertos") where.push("e.status IN ('nuevo','no_contesta','contactado','estudio_enviado')");
  else if (status) add("e.status = ?", status);
  if (priority) add("e.priority = ?", priority);
  if (canal) add("e.channel = ?", canal);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [{ total }] = await query<{ total: number }>(`SELECT count(*)::int total FROM energy_leads e ${w}`, params);
  const rows = await query<{
    id: string; vertical: string; full_name: string; phone: string; province: string | null; monthly_bill: number | null; property_type: string | null;
    priority: string; status: string; channel: string; campaign: string | null; commission: number | null; created_at: string;
  }>(
    `SELECT e.id, e.vertical, e.full_name, e.phone, e.province, e.monthly_bill, e.property_type, e.priority, e.status, e.channel, e.campaign,
            e.commission, e.created_at
       FROM energy_leads e ${w}
      ORDER BY (e.status = 'nuevo') DESC, e.priority, e.created_at DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
    params,
  );
  const vparams = linea ? [linea] : [];
  const vwhere = linea ? "WHERE vertical = $1" : "";
  const [k] = await query<{ mes: number; sin_llamar: number; contratados_mes: number; comision_mes: number | null }>(
    `SELECT count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int mes,
            count(*) FILTER (WHERE status = 'nuevo')::int sin_llamar,
            count(*) FILTER (WHERE converted_at >= date_trunc('month', now()))::int contratados_mes,
            sum(commission) FILTER (WHERE converted_at >= date_trunc('month', now())) comision_mes
       FROM energy_leads ${vwhere}`,
    vparams,
  );
  const counts = await query<{ vertical: string; n: number }>(
    "SELECT 'despachos' AS vertical, count(*)::int n FROM leads UNION ALL SELECT vertical, count(*)::int FROM energy_leads GROUP BY vertical",
  );
  const canales = await query<{ channel: string }>("SELECT DISTINCT channel FROM energy_leads ORDER BY 1");
  const href = (p: number) => {
    const u = new URLSearchParams(Object.entries({ linea, q, status, prioridad: priority, canal }).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `/energia?${u}`;
  };
  const title = linea ? VERTICALS[linea as "luz"].short : "Luz y placas";

  return (
    <>
      <PageHeader
        title={title}
        eyebrow="Recorta · afiliación"
        subtitle={`${total} leads con consentimiento. Llama primero a los nuevos de prioridad A.`}
        actions={
          <>
            <a href={`/api/export/energia${linea ? `?linea=${linea}` : ""}`} className={btn.secondary}>Exportar CSV</a>
            <Link href={`/energia/nuevo${linea ? `?linea=${linea}` : ""}`} className={btn.primary}>+ Lead manual</Link>
          </>
        }
      />
      <VerticalTabs active={(linea || "todas") as "luz"} counts={Object.fromEntries(counts.map((c) => [c.vertical, c.n]))} />
      <div className="lh-rail -mx-4 mb-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
        <Stat label="Sin llamar" value={k.sin_llamar} tone={k.sin_llamar > 0 ? "bad" : undefined} hint="Leads nuevos" />
        <Stat label="Entrados este mes" value={k.mes} />
        <Stat label="Contratos este mes" value={k.contratados_mes} tone="good" />
        <Stat label="Comisión del mes" value={eur(k.comision_mes ?? 0)} tone="good" />
      </div>
      <Filters active={[q, status, priority, canal].filter(Boolean).length}>
        <form className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {linea && <input type="hidden" name="linea" value={linea} />}
          <input name="q" defaultValue={q} placeholder="Nombre, teléfono, email…" className={`${input} col-span-2`} />
          <select name="status" defaultValue={status} className={input}>
            <option value="">Estado: todos</option>
            <option value="abiertos">Abiertos (sin cerrar)</option>
            {Object.entries(ENERGY_STATUS).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
          </select>
          <select name="prioridad" defaultValue={priority} className={input}>
            <option value="">Prioridad: todas</option>
            {["A", "B", "C"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="col-span-2 flex gap-2">
            <select name="canal" defaultValue={canal} className={input}>
              <option value="">Canal: todos</option>
              {canales.map((c) => <option key={c.channel} value={c.channel}>{c.channel}</option>)}
            </select>
            <button className={btn.secondary}>Filtrar</button>
          </div>
        </form>
      </Filters>
      {rows.length === 0 ? (
        <Empty>Todavía no ha entrado ningún lead{linea ? ` de ${title.toLowerCase()}` : " de luz ni de placas"}. Conecta ManyChat con la guía de Instagram (campo «linea»).</Empty>
      ) : (
        <Table head={["Nombre", "Entró", "Línea", "Factura", "Vivienda", "Prioridad", "Estado", "Canal", "Comisión"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td primary>
                <A href={`/energia/${r.id}`}>{r.full_name}</A>
                <div className="text-xs"><a className="text-indigo-600" href={telHref(r.phone)}>{r.phone}</a>{r.province ? ` · ${r.province}` : ""}</div>
              </Td>
              <Td className="text-xs">{ago(r.created_at)}</Td>
              <Td>{r.vertical === "luz" ? "💡 Luz" : "☀️ Placas"}</Td>
              <Td>{r.monthly_bill != null ? `${eur(r.monthly_bill)}/mes` : "—"}</Td>
              <Td hide>{r.property_type ? PROPERTY[r.property_type] ?? r.property_type : "—"}</Td>
              <Td><StatusBadge map={PRIORITY} value={r.priority} /></Td>
              <Td><StatusBadge map={ENERGY_STATUS} value={r.status} /></Td>
              <Td hide>{r.channel}<div className="max-w-40 truncate text-xs text-slate-500">{r.campaign}</div></Td>
              <Td hide>{r.commission != null ? eur(r.commission) : "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} makeHref={href} />
    </>
  );
}
