import { query } from "@/lib/db";
import { DEAL_STAGE, DEAL_STAGES, VERTICALS } from "@/lib/energy";
import { ago, dateTime, eur, telHref } from "@/lib/format";
import { listDeals } from "@/lib/services/deals";
import { A, Badge, ChipLink, Empty, PageHeader, Stat, Table, Td, btn, input } from "@/components/ui";

// Luz y placas no tienen citas: cada lead bueno se convierte en una oportunidad que avanza por etapas
// hasta el contrato activado (luz) o la obra firmada (placas).
export default async function Oportunidades(props: PageProps<"/oportunidades">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const vertical = ["luz", "placas"].includes(str("linea")) ? (str("linea") as "luz" | "placas") : "";
  const stage = str("etapa") in DEAL_STAGE ? str("etapa") : "";
  const client = /^[0-9a-f-]{36}$/.test(str("cliente")) ? str("cliente") : "";
  const rows = await listDeals({ vertical: vertical || null, stage: stage || null, clientId: client || null });
  const clients = await query<{ id: string; name: string }>("SELECT id, name FROM clients WHERE vertical <> 'lso' ORDER BY name");

  const open = rows.filter((r) => !["perdido", "rechazado", "activado", "firmado"].includes(r.stage));
  const won = rows.filter((r) => (r.vertical === "luz" ? r.stage === "activado" : r.stage === "firmado"));
  const waiting = rows.filter((r) => r.stage === "enviado");
  const stages = vertical ? DEAL_STAGES[vertical] : Array.from(new Set([...DEAL_STAGES.luz, ...DEAL_STAGES.placas]));
  const href = (o: Record<string, string>) => {
    const q = new URLSearchParams({ ...(vertical && { linea: vertical }), ...(stage && { etapa: stage }), ...(client && { cliente: client }), ...o });
    for (const [k, v] of Array.from(q.entries())) if (!v) q.delete(k);
    return `/oportunidades${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Oportunidades"
        eyebrow="Luz y placas"
        subtitle="Luz: estudio → oferta → firmado → activado (se cobra). Placas: enviado al instalador → aceptado (se cobra el lead) → visita → presupuesto → firmado (comisión)."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="Abiertas" value={open.length} />
        <Stat label="Esperando al instalador" value={waiting.length} hint="Se aceptan solas al pasar su plazo" tone={waiting.length ? "bad" : undefined} />
        <Stat label="Ganadas" value={won.length} tone="good" hint="Activadas (luz) y obras firmadas" />
        <Stat label="Obras firmadas" value={eur(won.reduce((a, r) => a + (r.signed_amount ?? 0), 0))} />
      </div>
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="lh-rail -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ChipLink href={href({ linea: "", etapa: "" })} active={!vertical}>Todas</ChipLink>
          <ChipLink href={href({ linea: "luz", etapa: "" })} active={vertical === "luz"}>Luz</ChipLink>
          <ChipLink href={href({ linea: "placas", etapa: "" })} active={vertical === "placas"}>Placas</ChipLink>
        </div>
        <form className="flex gap-2 md:ml-auto">
          {vertical && <input type="hidden" name="linea" value={vertical} />}
          <select name="etapa" defaultValue={stage} className={input}>
            <option value="">Todas las etapas</option>
            {stages.map((s) => <option key={s} value={s}>{DEAL_STAGE[s].label}</option>)}
          </select>
          <select name="cliente" defaultValue={client} className={input}>
            <option value="">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className={btn.secondary}>Filtrar</button>
        </form>
      </div>
      {rows.length === 0 ? (
        <Empty>Aún no hay oportunidades. Se crean al marcar una llamada de luz o placas como «Pedir factura» o «Pasar al instalador».</Empty>
      ) : (
        <Table head={["Lead", "Línea", "Negocio", "Factura", "Cliente", "Etapa", "Importe", "Actualizada"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td primary><A href={`/leads/${r.lead_id}`}>{r.full_name}</A>{r.phone && <div className="text-xs"><a href={telHref(r.phone)} className="text-slate-500">{r.phone}</a></div>}</Td>
              <Td><Badge tone={r.vertical === "luz" ? "amber" : "emerald"}>{VERTICALS[r.vertical].short}</Badge></Td>
              <Td hide>{r.business_type ?? "—"}{r.province && <div className="text-xs text-slate-400">{r.province}</div>}</Td>
              <Td>{r.monthly_bill != null ? `${eur(r.monthly_bill)}/mes` : "—"}{r.tariff && <div className="text-xs text-slate-400">{r.tariff}</div>}</Td>
              <Td hide>{r.cliente}</Td>
              <Td>
                <Badge tone={DEAL_STAGE[r.stage].tone}>{DEAL_STAGE[r.stage].label}</Badge>
                {r.stage === "enviado" && <div className="text-xs text-slate-400">plazo {r.accept_hours} h · enviado {ago(r.created_at)}</div>}
                {r.visit_at && r.stage === "visita" && <div className="text-xs text-slate-400">{dateTime(r.visit_at)}</div>}
              </Td>
              <Td hide>{r.signed_amount != null ? eur(r.signed_amount) : r.budget_amount != null ? `${eur(r.budget_amount)} (presup.)` : r.offer_annual_saving != null ? `${eur(r.offer_annual_saving)}/año` : "—"}</Td>
              <Td hide>{ago(r.updated_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
