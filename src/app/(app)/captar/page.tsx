// Captar clientes: de dónde salen los clientes de cada empresa y línea.
// Despachos (Leads Hunters) se captan por prospección; las demás líneas (Recorta luz y placas, MewHub webs…) por su embudo de Instagram.
import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { PRIORITY, statusMap } from "@/lib/lineas";
import { getLines } from "@/lib/services/lines";
import { ago, currentMonth, monthLabel } from "@/lib/format";
import { A, Card, ChipLink, Empty, PageHeader, StatusBadge, Table, Td, btn } from "@/components/ui";

type Funnel = { line_id: string; entraron: number; contactados: number; propuesta: number; cerrados: number; clientes: number; abiertos: number };

export default async function Captar(props: PageProps<"/captar">) {
  const sp = await props.searchParams;
  const sel = typeof sp.linea === "string" ? sp.linea : "";
  const month = currentMonth();
  const all = await getLines();
  const lines = sel ? all.filter((l) => l.slug === sel) : all;
  const start = `${month}-01`;

  const funnels = new Map(
    (await query<Funnel>(
      `SELECT bl.id AS line_id,
         (SELECT count(*) FROM line_leads ll WHERE ll.line_id = bl.id AND ll.created_at >= $1::date)::int entraron,
         (SELECT count(*) FROM line_leads ll WHERE ll.line_id = bl.id AND ll.created_at >= $1::date AND ll.first_contact_at IS NOT NULL)::int contactados,
         (SELECT count(*) FROM line_leads ll WHERE ll.line_id = bl.id AND ll.created_at >= $1::date AND ll.status IN ('propuesta','ganado'))::int propuesta,
         (SELECT count(*) FROM line_leads ll WHERE ll.line_id = bl.id AND ll.won_at >= $1::date)::int cerrados,
         (SELECT count(*) FROM line_clients lc WHERE lc.line_id = bl.id AND lc.status = 'activo')::int clientes,
         (SELECT count(*) FROM line_leads ll WHERE ll.line_id = bl.id AND ll.status IN ('nuevo','no_contesta','contactado','propuesta'))::int abiertos
       FROM business_lines bl WHERE bl.kind <> 'despachos'`,
      [start],
    )).map((f) => [f.line_id, f]),
  );
  const desp = await queryOne<{ prospectos: number; prioridad_a: number; en_marcha: number; clientes: number; particulares: number }>(
    `SELECT (SELECT count(*) FROM prospects WHERE status <> 'descartado')::int prospectos,
            (SELECT count(*) FROM prospects WHERE status <> 'descartado' AND score_tier = 'A')::int prioridad_a,
            (SELECT count(*) FROM prospects WHERE status IN ('contactado','interesado','reunion','propuesta'))::int en_marcha,
            (SELECT count(*) FROM clients WHERE status = 'activo' AND vertical = 'lso')::int clientes,
            (SELECT count(*) FROM leads WHERE vertical = 'lso' AND created_at >= $1::date)::int particulares`,
    [start],
  );
  const one = lines.length === 1 && lines[0].kind !== "despachos" ? lines[0] : null;
  const recent = one
    ? await query<{ id: string; full_name: string; status: string; priority: string; created_at: string; channel: string; client_id: string | null }>(
        "SELECT id, full_name, status, priority, created_at, channel, client_id FROM line_leads WHERE line_id = $1 ORDER BY created_at DESC LIMIT 20",
        [one.id],
      )
    : [];
  const companies = Array.from(new Map(lines.map((l) => [l.company_id, l.company_name])).entries());

  return (
    <>
      <PageHeader
        title="Captar clientes"
        eyebrow="De dónde salen tus clientes"
        subtitle={`Cada empresa y línea con su embudo de Instagram. Datos de ${monthLabel(month)}.`}
        actions={<Link href="/negocios" className={btn.secondary}>+ Empresa o línea</Link>}
      />
      <div className="lh-rail -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ChipLink href="/captar" active={!sel}>Todas</ChipLink>
        {all.map((l) => (
          <ChipLink key={l.slug} href={`/captar?linea=${l.slug}`} active={sel === l.slug}>
            {l.emoji} {l.kind === "despachos" ? "Segunda Oportunidad" : l.name} <span className="text-xs opacity-60">· {l.company_name}</span>
          </ChipLink>
        ))}
      </div>

      {companies.map(([cid, cname]) => (
        <section key={cid} className="mb-7">
          <h2 className="mb-3 font-display text-lg font-semibold">{cname}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {lines.filter((l) => l.company_id === cid).map((l) => {
              if (l.kind === "despachos") {
                return (
                  <Card key={l.id} title={`${l.emoji} Segunda Oportunidad · despachos`}>
                    <p className="mb-3 text-sm text-slate-600">Tus clientes son despachos: se captan por prospección y llamada. Los particulares con deudas entran por el embudo <b>DEUDAS</b> de Instagram al test.</p>
                    <FunnelRow steps={[["Despachos a captar", desp?.prospectos ?? 0], ["Prioridad A", desp?.prioridad_a ?? 0], ["En conversación", desp?.en_marcha ?? 0], ["Clientes activos", desp?.clientes ?? 0]]} />
                    <p className="mt-2 text-xs text-slate-500">{desp?.particulares ?? 0} particulares con deudas este mes (test e Instagram).</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/prospeccion" className={btn.secondary}>Ver despachos</Link>
                      <Link href="/prospeccion/llamar" className={btn.hunt}>Llamar despachos</Link>
                      <Link href="/particulares" className={btn.ghost}>Embudo DEUDAS →</Link>
                    </div>
                  </Card>
                );
              }
              const f = funnels.get(l.id);
              return (
                <Card key={l.id} title={`${l.emoji} ${l.name}`}>
                  <p className="mb-3 text-sm text-slate-600">
                    Embudo de Instagram: palabra clave <b>{l.slug.toUpperCase()}</b> en ManyChat{l.keywords.length ? ` (también: ${l.keywords.slice(0, 4).join(", ")})` : ""}. Los leads entran en Leads y, al cerrar, los conviertes en cliente.
                  </p>
                  <FunnelRow steps={[["Entraron", f?.entraron ?? 0], ["Contactados", f?.contactados ?? 0], [l.proposal_label, f?.propuesta ?? 0], [l.won_label, f?.cerrados ?? 0]]} />
                  <p className="mt-2 text-xs text-slate-500">{f?.abiertos ?? 0} leads abiertos · {f?.clientes ?? 0} clientes activos</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/lineas?linea=${l.slug}`} className={btn.secondary}>Ver leads</Link>
                    <Link href={`/lineas/cola?linea=${l.slug}`} className={btn.hunt}>Cazar</Link>
                    <Link href={`/negocios/${l.id}`} className={btn.ghost}>Embudo de Instagram →</Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      {one && (
        <Card title={`Últimos leads de ${one.name}`} flush>
          {recent.length === 0 ? <div className="p-5"><Empty>Todavía no ha entrado ninguno. Configura el embudo de Instagram de la línea.</Empty></div> : (
            <Table head={["Lead", "Entró", "Canal", "Prioridad", "Estado", ""]}>
              {recent.map((r) => (
                <tr key={r.id}>
                  <Td primary><A href={`/lineas/${r.id}`}>{r.full_name}</A></Td>
                  <Td>{ago(r.created_at)}</Td>
                  <Td hide>{r.channel}</Td>
                  <Td><StatusBadge map={PRIORITY} value={r.priority} /></Td>
                  <Td><StatusBadge map={statusMap(one)} value={r.status} /></Td>
                  <Td>{r.client_id ? <A href={`/clientes/l/${r.client_id}`} className="text-xs">Cliente →</A> : <A href={`/lineas/${r.id}`} className="text-xs">Convertir</A>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}
    </>
  );
}

function FunnelRow({ steps }: { steps: [string, number][] }) {
  const max = Math.max(1, ...steps.map(([, n]) => n));
  return (
    <ol className="grid grid-cols-4 gap-2">
      {steps.map(([k, n]) => (
        <li key={k} className="rounded-xl border border-slate-200 p-2 text-center">
          <div className="num text-lg font-semibold">{n}</div>
          <div className="mx-auto my-1 h-1 rounded-full bg-slate-100"><div className="h-1 rounded-full bg-blaze" style={{ width: `${(100 * n) / max}%` }} /></div>
          <div className="text-[11px] leading-tight text-slate-500">{k}</div>
        </li>
      ))}
    </ol>
  );
}
