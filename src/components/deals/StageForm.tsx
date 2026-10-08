import { btn, input, label } from "@/components/ui";
import { DEAL_STAGE, DEAL_STAGES, nextStages } from "@/lib/energy";
import { toLocalInput } from "@/lib/format";
import type { DealRow } from "@/lib/services/deals";

/**
 * Formulario para mover una oportunidad. El equipo ve todas las etapas (para corregir);
 * el socio solo los siguientes pasos. Sin JavaScript: los campos extra se rellenan si aplican.
 */
export function StageForm({ deal, action, partner = false }: { deal: DealRow; action: (fd: FormData) => void; partner?: boolean }) {
  const next = nextStages(deal.vertical, deal.stage);
  const options = partner ? next : [...next, ...DEAL_STAGES[deal.vertical].filter((s) => s !== deal.stage && !next.includes(s))];
  if (!options.length) return null;
  const luz = deal.vertical === "luz";
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className={label}>Pasar a</span>
        <select name="stage" defaultValue={next[0] ?? options[0]} className={input}>
          {options.map((s) => <option key={s} value={s}>{DEAL_STAGE[s].label}{!next.includes(s) ? " (corregir)" : ""}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        {luz ? (
          <>
            <label><span className={label}>Comercializadora de la oferta</span><input name="offer_supplier" defaultValue={deal.offer_supplier ?? ""} className={input} /></label>
            <label><span className={label}>Ahorro anual de la oferta (€)</span><input name="offer_annual_saving" inputMode="decimal" defaultValue={deal.offer_annual_saving ?? ""} className={input} /></label>
          </>
        ) : (
          <>
            <label><span className={label}>Visita técnica</span><input type="datetime-local" name="visit_at" defaultValue={deal.visit_at ? toLocalInput(new Date(deal.visit_at)) : ""} className={input} /></label>
            <label><span className={label}>Potencia (kWp)</span><input name="kwp" inputMode="decimal" defaultValue={deal.kwp ?? ""} className={input} /></label>
            <label><span className={label}>Presupuesto (€)</span><input name="budget_amount" inputMode="decimal" defaultValue={deal.budget_amount ?? ""} className={input} /></label>
            <label><span className={label}>Obra firmada (€)</span><input name="signed_amount" inputMode="decimal" defaultValue={deal.signed_amount ?? ""} className={input} placeholder="solo al firmar" /></label>
          </>
        )}
      </div>
      <label className="block"><span className={label}>Nota o motivo</span><input name="note" className={input} placeholder={luz ? "p. ej. tiene permanencia hasta junio" : "p. ej. fuera de zona, no contesta…"} /></label>
      <button className={`${btn.primary} w-full`}>Guardar</button>
    </form>
  );
}
