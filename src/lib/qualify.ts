// Cualificación de leads para la Ley de Segunda Oportunidad (LSO).
// Requisitos legales básicos (TRLC tras la Ley 16/2022): persona física insolvente y de buena fe (art. 487),
// ≥2 acreedores (criterio de los juzgados), sin exoneración en los últimos 2 años con plan de pagos
// o 5 con liquidación (art. 488) y sin condenas firmes por delitos económicos en 10 años.
// El tope de 5 M€ no es legal: es un filtro comercial (casos así no son de este servicio).
// El despacho fija su deuda mínima (los casos pequeños no le salen rentables).

import type { LeadFields } from "./normalize";

export type ClientCriteria = { min_debt: number; min_creditors: number; provinces: string[] };
export type QualifyResult = {
  score: number;
  status: "cualificado" | "dudoso" | "no_cualificado" | "pendiente";
  reasons: string[];
};

const eur = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";

export function qualifyLead(l: LeadFields, c: ClientCriteria): QualifyResult {
  const reasons: string[] = [];
  const fails: string[] = [];
  let score = 0;

  if (l.prior_lso === true) fails.push("Obtuvo la exoneración hace menos de 2 años: aún no puede volver a pedirla");
  if (l.criminal_record === true) fails.push("Tiene condenas por delitos económicos");
  if (l.debt_amount != null && l.debt_amount > 5_000_000) fails.push("Deuda superior a 5 M€ (fuera de este servicio)");
  if (l.debt_amount != null && l.debt_amount < c.min_debt) fails.push(`Deuda de ${eur(l.debt_amount)}, por debajo del mínimo del despacho (${eur(c.min_debt)})`);
  if (l.creditors_count != null && l.creditors_count < c.min_creditors) fails.push(`Solo ${l.creditors_count} acreedor(es); el mínimo es ${c.min_creditors}`);

  // Deuda (35)
  if (l.debt_amount == null) reasons.push("Deuda sin indicar: preguntar en la llamada");
  else if (l.debt_amount >= 30000) { score += 35; reasons.push(`Deuda alta: ${eur(l.debt_amount)}`); }
  else if (l.debt_amount >= 15000) { score += 28; reasons.push(`Deuda media: ${eur(l.debt_amount)}`); }
  else if (l.debt_amount >= c.min_debt) { score += 18; reasons.push(`Deuda justa: ${eur(l.debt_amount)}`); }

  // Acreedores (20)
  if (l.creditors_count == null) reasons.push("Nº de acreedores sin indicar");
  else if (l.creditors_count >= 5) { score += 20; reasons.push(`${l.creditors_count} acreedores`); }
  else if (l.creditors_count >= 3) { score += 15; reasons.push(`${l.creditors_count} acreedores`); }
  else if (l.creditors_count >= 2) { score += 10; reasons.push(`${l.creditors_count} acreedores`); }

  // Insolvencia: la deuda no se puede pagar con los ingresos (20)
  if (l.debt_amount != null && l.monthly_income != null && l.monthly_income >= 0) {
    const ratio = l.monthly_income > 0 ? l.debt_amount / (l.monthly_income * 12) : 99;
    if (ratio >= 1) { score += 20; reasons.push("La deuda supera un año de ingresos: insolvencia clara"); }
    else if (ratio >= 0.5) { score += 12; reasons.push("Deuda equivalente a medio año de ingresos"); }
    else { score += 4; reasons.push("Ingresos altos respecto a la deuda: puede que no sea insolvente"); }
  } else {
    score += 8;
  }

  // Situación laboral (10): puede pagar honorarios del despacho
  switch (l.employment_status) {
    case "asalariado": case "pensionista": score += 10; reasons.push("Ingresos estables (puede pagar honorarios)"); break;
    case "autonomo": score += 8; reasons.push("Autónomo"); break;
    case "desempleado": score += 4; reasons.push("Desempleado: confirmar cómo pagaría honorarios"); break;
    default: score += 5;
  }

  // Vivienda (5): sin vivienda en propiedad es un caso más sencillo
  if (l.owns_home === false) { score += 5; reasons.push("Sin vivienda en propiedad (caso sencillo)"); }
  else if (l.owns_home === true) reasons.push("Tiene vivienda en propiedad: caso más complejo");

  // Contactable (10)
  if (l.phone) score += 10;
  else fails.push("Sin teléfono");

  if (c.provinces.length && l.province && !c.provinces.includes(l.province)) {
    reasons.push(`Provincia ${l.province} fuera de la zona del despacho`);
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));
  if (fails.length) return { score: Math.min(score, 20), status: "no_cualificado", reasons: [...fails, ...reasons] };
  if (l.debt_amount == null && l.creditors_count == null) return { score, status: "pendiente", reasons };
  return { score, status: score >= 55 ? "cualificado" : "dudoso", reasons };
}
