import { Badge, Card, btn } from "@/components/ui";
import { DEAL_STAGE, VERTICALS } from "@/lib/energy";
import { dateTime, eur } from "@/lib/format";
import { appUrl } from "@/lib/appUrl";
import { dealHistory, type DealListRow } from "@/lib/services/deals";
import { moveDeal, resendDeal } from "@/app/(app)/oportunidades/actions";
import { StageForm } from "./StageForm";

/** Ficha de la oportunidad en el lead: etapa, datos de la oferta u obra, enlace del socio e historial. */
export async function DealCard({ deal }: { deal: DealListRow }) {
  const st = DEAL_STAGE[deal.stage];
  const history = await dealHistory(deal.id);
  const base = appUrl() || "";
  const partner = VERTICALS[deal.vertical].partner.toLowerCase();
  return (
    <Card title="Oportunidad" actions={<Badge tone={st.tone}>{st.label}</Badge>}>
      <p className="text-sm text-slate-600">{st.hint}.</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {deal.offer_supplier && <><dt className="text-slate-500">Oferta</dt><dd>{deal.offer_supplier}</dd></>}
        {deal.offer_annual_saving != null && <><dt className="text-slate-500">Ahorro/año</dt><dd>{eur(deal.offer_annual_saving)}</dd></>}
        {deal.visit_at && <><dt className="text-slate-500">Visita</dt><dd>{dateTime(deal.visit_at)}</dd></>}
        {deal.kwp != null && <><dt className="text-slate-500">Potencia</dt><dd>{deal.kwp} kWp</dd></>}
        {deal.budget_amount != null && <><dt className="text-slate-500">Presupuesto</dt><dd>{eur(deal.budget_amount)}</dd></>}
        {deal.signed_amount != null && <><dt className="text-slate-500">Obra firmada</dt><dd>{eur(deal.signed_amount)}</dd></>}
        {deal.accepted_at && <><dt className="text-slate-500">Aceptado</dt><dd>{dateTime(deal.accepted_at)} ({deal.accepted_by})</dd></>}
        {deal.activated_at && <><dt className="text-slate-500">Activado</dt><dd>{dateTime(deal.activated_at)}</dd></>}
      </dl>
      <div className="mt-4"><StageForm deal={deal} action={moveDeal.bind(null, deal.id, deal.lead_id)} /></div>
      {deal.vertical === "placas" && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <div className="font-medium text-slate-700">Enlace del {partner}</div>
          <div className="mt-1 select-all break-all font-mono">{base}/socio/{deal.partner_token}</div>
          <div className="mt-1">{deal.partner_notified_at ? `Avisado ${dateTime(deal.partner_notified_at)}` : "Aún no se le ha avisado"}</div>
          <form action={resendDeal.bind(null, deal.id, deal.lead_id)} className="mt-2"><button className={btn.secondary}>Volver a avisar</button></form>
        </div>
      )}
      {history.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
          {history.map((h, i) => (
            <li key={i}><span className="text-slate-400">{dateTime(h.created_at)}</span> · {DEAL_STAGE[h.stage]?.label ?? h.stage} · {h.by_who}{h.note ? ` · ${h.note}` : ""}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
