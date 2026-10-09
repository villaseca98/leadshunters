// Estimaciones rápidas para la llamada, según la naturaleza de cada línea. Son orientativas (se muestran como «estimado»).
export type Estimate = { label: string; value: string; hint?: string };

const PRICE_KWH = 0.2; // €/kWh medio con impuestos
const YIELD_KWH_PER_KWP = 1450; // producción anual media en España por kWp bien orientado
const COST_PER_KWP = 1300; // € por kWp instalado (sin batería)
const BATTERY = 4000; // € batería doméstica media
const ORIENTATION: Record<string, number> = { sur: 1, este_oeste: 0.85, norte: 0.6 };

const n = (v: unknown) => {
  const x = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(x) && x > 0 ? x : null;
};
const eur = (x: number) => `${Math.round(x).toLocaleString("es-ES")} €`;

export function estimate(slug: string, data: Record<string, unknown>, ops: Record<string, unknown>): Estimate[] {
  const factura = n(data.factura);
  if (slug === "luz") {
    const anual = factura ? factura * 12 : null;
    const consumo = n(ops.consumo_anual_kwh);
    const out: Estimate[] = [];
    if (anual) {
      out.push({ label: "Gasto anual en luz", value: eur(anual), hint: `${eur(factura!)} al mes` });
      out.push({ label: "Ahorro posible", value: `${eur(anual * 0.1)} – ${eur(anual * 0.2)} al año`, hint: "entre el 10 y el 20 % con una tarifa ajustada" });
    }
    if (anual && consumo) out.push({ label: "Precio que paga", value: `${(anual / consumo).toFixed(2).replace(".", ",")} €/kWh`, hint: `media de mercado ≈ ${PRICE_KWH.toFixed(2).replace(".", ",")} €/kWh` });
    const p = n(ops.potencia_kw);
    if (p && p > 15) out.push({ label: "Tarifa", value: "3.0TD o superior", hint: "más de 15 kW: cliente de empresa" });
    return out;
  }
  if (slug === "placas") {
    const consumo = n(ops.consumo_anual_kwh) ?? (factura ? (factura * 12) / PRICE_KWH : null);
    if (!consumo) return [];
    const orient = ORIENTATION[String(ops.orientacion ?? "")] ?? 1;
    let kwp = Math.max(1.5, Math.round(((consumo * 0.7) / (YIELD_KWH_PER_KWP * orient)) * 2) / 2);
    const m2 = n(ops.superficie_m2);
    if (m2) kwp = Math.min(kwp, Math.max(1, Math.floor((m2 / 5) * 2) / 2)); // ≈ 5 m² por kWp
    const produccion = kwp * YIELD_KWH_PER_KWP * orient;
    const coste = kwp * COST_PER_KWP + (ops.bateria === "si" ? BATTERY : 0);
    const ahorro = Math.min(produccion, consumo) * 0.7 * PRICE_KWH + Math.max(0, produccion - consumo * 0.7) * 0.06;
    return [
      { label: "Instalación recomendada", value: `${kwp.toLocaleString("es-ES")} kWp`, hint: `${Math.ceil(kwp / 0.45)} paneles de 450 W${m2 ? ` · cabe en ${m2} m²` : ""}` },
      { label: "Producción anual", value: `${Math.round(produccion).toLocaleString("es-ES")} kWh`, hint: `consume ≈ ${Math.round(consumo).toLocaleString("es-ES")} kWh al año` },
      { label: "Importe de la obra", value: eur(coste), hint: ops.bateria === "si" ? "con batería" : "sin batería" },
      { label: "Ahorro anual", value: eur(ahorro), hint: `se paga en ${(coste / ahorro).toFixed(1).replace(".", ",")} años` },
    ];
  }
  if (slug === "web") {
    const pag = n(ops.paginas);
    const importe = n(data.presupuesto) ?? (pag ? 400 + 150 * pag : null);
    if (!importe) return [];
    const out: Estimate[] = [
      { label: "Importe de la web", value: eur(importe), hint: n(data.presupuesto) ? "según su presupuesto" : `${pag} páginas` },
      { label: "Mantenimiento sugerido", value: `${eur(Math.max(30, importe * 0.04))} al mes`, hint: "actualizaciones, copias y cambios pequeños" },
      { label: "Valor del primer año", value: eur(importe + 12 * Math.max(30, importe * 0.04)) },
    ];
    if (ops.plazo === "urgente") out.push({ label: "Urgencia", value: "+20 % por entrega rápida", hint: eur(importe * 1.2) });
    return out;
  }
  const pres = n(ops.presupuesto);
  return pres ? [{ label: "Presupuesto", value: eur(pres) }] : [];
}
