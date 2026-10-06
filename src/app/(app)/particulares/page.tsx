// Personas que han hecho el test público (/test). Las que no tienen despacho en su provincia son el argumento de venta.
import { query } from "@/lib/db";
import { appUrl } from "@/lib/appUrl";
import { dateTime, eur, telHref } from "@/lib/format";
import { A, Badge, Card, Empty, PageHeader, Stat, Table, Td, btn } from "@/components/ui";

const VERDICT: Record<string, { label: string; tone: "emerald" | "indigo" | "slate" }> = {
  apto: { label: "Cumple", tone: "emerald" },
  revisar: { label: "Revisar", tone: "indigo" },
  no_apto: { label: "No cumple", tone: "slate" },
};

export default async function Particulares() {
  const [stats] = await query<{ total: number; aptos: number; sin_despacho: number }>(
    `SELECT count(*)::int total, count(*) FILTER (WHERE verdict = 'apto')::int aptos,
            count(*) FILTER (WHERE client_id IS NULL AND verdict <> 'no_apto')::int sin_despacho
       FROM test_submissions WHERE created_at > now() - interval '30 days'`,
  );
  const byProvince = await query<{ province: string; personas: number; deuda_media: number | null }>(
    `SELECT province, count(*)::int personas, avg((answers->>'debt')::numeric)::int deuda_media
       FROM test_submissions WHERE client_id IS NULL AND verdict <> 'no_apto' AND created_at > now() - interval '30 days'
      GROUP BY province ORDER BY personas DESC`,
  );
  const rows = await query<{
    id: string; full_name: string; phone: string; province: string | null; verdict: string; cliente: string | null; lead_id: string | null;
    debt: string; utm_source: string | null; created_at: string;
  }>(
    `SELECT t.id, t.full_name, t.phone, t.province, t.verdict, c.name AS cliente, t.lead_id, t.answers->>'debt' AS debt,
            t.utm->>'utm_source' AS utm_source, t.created_at
       FROM test_submissions t LEFT JOIN clients c ON c.id = t.client_id ORDER BY t.created_at DESC LIMIT 100`,
  );
  const link = `${appUrl()}/test`;

  return (
    <>
      <PageHeader
        title="Test para particulares"
        eyebrow="Captación propia"
        subtitle="Personas que han hecho el test «¿Puedo cancelar mis deudas?» con su consentimiento. Pon este enlace en tus anuncios."
        actions={<a href="/test" target="_blank" className={btn.primary}>Abrir el test ↗</a>}
      />
      <Card className="mb-4">
        <div className="text-xs text-slate-500">Enlace para los anuncios (añade ?utm_source=facebook&amp;utm_campaign=… para saber de dónde viene cada uno)</div>
        <div className="mt-1 select-all break-all font-mono text-sm">{link || "/test"}</div>
      </Card>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Tests (30 días)" value={stats.total} />
        <Stat label="Cumplen requisitos" value={stats.aptos} tone="good" />
        <Stat label="Sin despacho" value={stats.sin_despacho} hint="para vender" />
      </div>
      {byProvince.length > 0 && (
        <Card title="Personas esperando despacho, por provincia" className="mb-4">
          <p className="mb-3 text-xs text-slate-500">Úsalo al llamar a despachos: «Este mes {byProvince[0].personas === 1 ? "una persona" : `${byProvince[0].personas} personas`} de {byProvince[0].province} {byProvince[0].personas === 1 ? "ha" : "han"} pedido ayuda y no tengo despacho allí».</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {byProvince.map((p) => (
              <li key={p.province} className="flex justify-between py-2">
                <span className="font-medium">{p.province}</span>
                <span className="text-slate-600">{p.personas} {p.personas === 1 ? "persona" : "personas"} · deuda media {eur(p.deuda_media)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {rows.length === 0 ? (
        <Empty>Todavía nadie ha hecho el test. Lánzalo en un anuncio de Meta con el enlace de arriba.</Empty>
      ) : (
        <Table head={["Nombre", "Entró", "Provincia", "Deuda", "Resultado", "Despacho", "Origen"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td primary>
                {r.lead_id ? <A href={`/leads/${r.lead_id}`}>{r.full_name}</A> : r.full_name}
                <div className="text-xs"><a className="text-indigo-600" href={telHref(r.phone)}>{r.phone}</a></div>
              </Td>
              <Td className="text-xs">{dateTime(r.created_at)}</Td>
              <Td>{r.province ?? "—"}</Td>
              <Td>{eur(Number(r.debt))}</Td>
              <Td><Badge tone={VERDICT[r.verdict]?.tone ?? "slate"}>{VERDICT[r.verdict]?.label ?? r.verdict}</Badge></Td>
              <Td>{r.cliente ?? <span className="text-slate-400">Sin despacho</span>}</Td>
              <Td hide>{r.utm_source ?? "directo"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
