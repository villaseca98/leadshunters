import { parseMoney } from "./normalize";
import { fromLocalInput } from "./format";
import type { StageExtra } from "./services/deals";

/** Lee los campos opcionales del formulario de etapa (oferta, visita, presupuesto, obra…). */
export function stageExtra(formData: FormData): StageExtra {
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const visit = g("visit_at");
  return {
    offer_supplier: g("offer_supplier") || null,
    offer_annual_saving: parseMoney(g("offer_annual_saving")),
    visit_at: visit ? fromLocalInput(visit).toISOString() : null,
    budget_amount: parseMoney(g("budget_amount")),
    kwp: parseMoney(g("kwp")),
    signed_amount: parseMoney(g("signed_amount")),
    note: g("note") || null,
  };
}
