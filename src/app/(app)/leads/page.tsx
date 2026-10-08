import Link from "next/link";
import { query } from "@/lib/db";
import { LEAD_STATUS, QUALIFICATION, SOURCE } from "@/lib/labels";
import { dateTime, eur } from "@/lib/format";
import { VerticalTabs } from "@/components/VerticalTabs";
import { A, Empty, Filters, PageHeader, Pager, StatusBadge, Table, Td, btn, input } from "@/components/ui";

const PER_PAGE = 50;

export default async function Leads(props: PageProps<"/leads">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q"), client = str("cliente"), status = str("status"), qual = str("cualificacion"), source = str("origen");
  const page = Math.max(1, Number(str("page") || 1));
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll("?", `$${params.length}`)); };
  if (q) add("(l.full_name ILIKE ? OR l.phone ILIKE ? OR l.email ILIKE ?)", `%${q}%`);
  if (client) add("l.client_id = ?", client);
  if (status) add("l.status = ?", status);
  if (qual) add("l.qualification_status = ?", qual);
  if (source) add("l.source = ?", source);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [{ total }] = await query<{ total: number }>(`SELECT count(*)::int total FROM leads l ${w}`, params);
  const rows = await query<{
    id: string; full_name: string; phone: string | null; cliente: string; source: string; campaign: string | null; status: string;
    qualification_status: string; qualification_score: number; debt_amount: number | null; creditors_count: number | null; attempts: number; created_at: string;
  }>(
    `SELECT l.id, l.full_name, l.phone, c.name AS cliente, l.source, l.campaign, l.status, l.qualification_status, l.qualification_score,
            l.debt_amount, l.creditors_count, l.attempts, l.created_at
       FROM leads l JOIN clients c ON c.id = l.client_id ${w} ORDER BY l.created_at DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
    params,
  );
  const clients = await query<{ id: string; name: string }>("SELECT id, name FROM clients ORDER BY name");
  const href = (p: number) => {
    const u = new URLSearchParams(Object.entries({ q, cliente: client, status, cualificacion: qual, origen: source }).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `/leads?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${total} leads de particulares con deudas (con consentimiento del formulario)`}
        actions={
          <>
            <a href={`/api/export/leads?${new URLSearchParams(Object.entries({ cliente: client, status }).filter(([, v]) => v) as [string, string][])}`} className={btn.secondary}>Exportar CSV</a>
            <Link href="/leads/nuevo" className={btn.primary}>+ Lead manual</Link>
          </>
        }
      />
      <VerticalTabs active="despachos" />
      <Filters active={[client, status, qual, source].filter(Boolean).length}>
      <form className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <input name="q" defaultValue={q} placeholder="Nombre, teléfono, email…" className={`${input} col-span-2`} />
        <select name="cliente" defaultValue={client} className={input}>
          <option value="">Cliente: todos</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="status" defaultValue={status} className={input}>
          <option value="">Estado: todos</option>
          {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="cualificacion" defaultValue={qual} className={input}>
          <option value="">Cualificación: todas</option>
          {Object.entries(QUALIFICATION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="origen" defaultValue={source} className={input}>
            <option value="">Origen: todos</option>
            {["meta", "google", "web", "manual", "otro"].map((s) => <option key={s} value={s}>{SOURCE[s]}</option>)}
          </select>
          <button className={btn.secondary}>Filtrar</button>
        </div>
      </form>
      </Filters>
      {rows.length === 0 ? (
        <Empty>No hay leads todavía. Conecta los formularios de Meta o Google con los flujos de n8n.</Empty>
      ) : (
        <Table head={["Nombre", "Entró", "Cliente", "Origen", "Deuda", "Acreedores", "Cualificación", "Estado", "Intentos"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td primary><A href={`/leads/${r.id}`}>{r.full_name}</A><div className="text-xs text-slate-500">{r.phone ?? "—"}</div></Td>
              <Td className="text-xs">{dateTime(r.created_at)}</Td>
              <Td>{r.cliente}</Td>
              <Td hide>{SOURCE[r.source] ?? r.source}<div className="max-w-40 truncate text-xs text-slate-500">{r.campaign}</div></Td>
              <Td>{eur(r.debt_amount)}</Td>
              <Td hide>{r.creditors_count ?? "—"}</Td>
              <Td><StatusBadge map={QUALIFICATION} value={r.qualification_status} /> <span className="text-xs text-slate-500">{r.qualification_score}</span></Td>
              <Td><StatusBadge map={LEAD_STATUS} value={r.status} /></Td>
              <Td hide>{r.attempts}</Td>
            </tr>
          ))}
        </Table>
      )}
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} makeHref={href} />
    </>
  );
}
