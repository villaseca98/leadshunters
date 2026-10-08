// Líneas de negocio de energía (marca Recorta): luz de negocios y placas solares.
// Lógica pura (sin base de datos) para poder probarla: cualificación, etapas de la oportunidad y cobro.
import type { Tone } from "./labels";

export type Vertical = "lso" | "luz" | "placas";
export const VERTICALS: Record<Vertical, { label: string; partner: string; short: string }> = {
  lso: { label: "Segunda Oportunidad", partner: "Despacho", short: "LSO" },
  luz: { label: "Luz de negocios", partner: "Comercializadora", short: "Luz" },
  placas: { label: "Placas solares", partner: "Instalador", short: "Placas" },
};
export const isEnergy = (v: string | null | undefined): v is "luz" | "placas" => v === "luz" || v === "placas";

export type EnergyFields = {
  phone?: string | null;
  email?: string | null;
  province?: string | null;
  business_type?: string | null;
  monthly_bill?: number | null;
  tariff?: string | null;
  contracted_power_kw?: number | null;
  current_supplier?: string | null;
  roof?: string | null;
  daytime_share?: number | null;
};
export type EnergyCriteria = { vertical: "luz" | "placas"; min_monthly_bill: number | null; provinces: string[] };
export type EnergyQualification = { score: number; status: "cualificado" | "dudoso" | "no_cualificado" | "pendiente"; reasons: string[] };

export const DEFAULT_MIN_BILL = { luz: 60, placas: 80 } as const;
export const TARIFFS = ["2.0TD", "3.0TD", "6.1TD"] as const;
export const ROOFS: Record<string, string> = {
  propio: "Tejado o cubierta propia",
  comunidad: "Cubierta de la comunidad",
  alquiler: "Local en alquiler",
  no: "Sin cubierta disponible",
};

const eur = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";

/** Normaliza la tarifa escrita de cualquier forma ("3.0 TD", "30td", "6.1") a 2.0TD | 3.0TD | 6.1TD. */
export function parseTariff(input: unknown): string | null {
  if (!input) return null;
  const s = String(input).toLowerCase().replace(/[\s.,]/g, "");
  if (/^20(td|a)?|^2\b/.test(s)) return "2.0TD";
  if (/^30(td|a)?|^3\b/.test(s)) return "3.0TD";
  if (/^61(td|a)?|^6\b/.test(s)) return "6.1TD";
  return null;
}

/** propio | comunidad | alquiler | no a partir de texto libre. */
export function parseRoof(input: unknown): string | null {
  if (input === null || input === undefined || input === "") return null;
  const s = String(input).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/comunidad|vecin/.test(s)) return "comunidad";
  if (/alquil|arrend/.test(s)) return "alquiler";
  if (/^(no|sin|ninguna)/.test(s)) return "no";
  if (/propi|mio|mia|nave|si\b|^s$|tejado|cubierta|terraza/.test(s)) return "propio";
  return null;
}

/**
 * Cualifica un lead de energía. Luz: cuanto más alta la factura y más compleja la tarifa, más comisión.
 * Placas: además importa la cubierta y cuánto consume de día (lo que se autoconsume es lo que ahorra).
 */
export function qualifyEnergyLead(l: EnergyFields, c: EnergyCriteria): EnergyQualification {
  const reasons: string[] = [];
  const fails: string[] = [];
  let score = 0;
  const minBill = c.min_monthly_bill ?? DEFAULT_MIN_BILL[c.vertical];
  const bill = l.monthly_bill ?? null;

  if (bill == null) reasons.push("Factura mensual sin indicar: pedirla en la llamada");
  else if (bill < minBill) fails.push(`Factura de ${eur(bill)}/mes, por debajo del mínimo (${eur(minBill)}/mes)`);

  if (c.vertical === "luz") {
    if (bill != null) {
      if (bill >= 500) { score += 40; reasons.push(`Factura alta: ${eur(bill)}/mes`); }
      else if (bill >= 200) { score += 32; reasons.push(`Factura media: ${eur(bill)}/mes`); }
      else if (bill >= 100) { score += 22; reasons.push(`Factura de ${eur(bill)}/mes`); }
      else { score += 12; reasons.push(`Factura pequeña: ${eur(bill)}/mes`); }
    }
    if (l.tariff === "6.1TD") { score += 20; reasons.push("Tarifa 6.1TD: gran consumidor"); }
    else if (l.tariff === "3.0TD") { score += 15; reasons.push("Tarifa 3.0TD: más de 15 kW, revisar potencia y reactiva"); }
    else if (l.tariff === "2.0TD") { score += 6; reasons.push("Tarifa 2.0TD"); }
    else { score += 6; reasons.push("Tarifa sin indicar"); }
    if (l.current_supplier) { score += 5; reasons.push(`Comercializadora actual: ${l.current_supplier}`); }
    if (l.business_type) { score += 10; reasons.push(`Negocio: ${l.business_type}`); }
  } else {
    if (bill != null) {
      if (bill >= 300) { score += 35; reasons.push(`Factura alta: ${eur(bill)}/mes`); }
      else if (bill >= 150) { score += 28; reasons.push(`Factura de ${eur(bill)}/mes`); }
      else { score += 16; reasons.push(`Factura justa para placas: ${eur(bill)}/mes`); }
    }
    switch (l.roof) {
      case "propio": score += 20; reasons.push("Cubierta propia"); break;
      case "comunidad": score += 8; reasons.push("Cubierta de la comunidad: necesita acuerdo de la junta"); break;
      case "alquiler": score += 4; reasons.push("Local en alquiler: necesita permiso del propietario"); break;
      case "no": fails.push("No tiene cubierta donde poner placas"); break;
      default: score += 8; reasons.push("Cubierta sin indicar: preguntar en la llamada");
    }
    const d = l.daytime_share;
    if (d == null) score += 8;
    else if (d >= 60) { score += 20; reasons.push(`${d}% del consumo de día: aprovecha casi todo lo que produce`); }
    else if (d >= 40) { score += 12; reasons.push(`${d}% del consumo de día`); }
    else { score += 4; reasons.push(`Solo ${d}% del consumo de día: le conviene batería virtual o batería`); }
    if (l.business_type) { score += 5; reasons.push(`Negocio: ${l.business_type}`); }
  }

  if (l.phone) score += 10;
  else fails.push("Sin teléfono");
  if (l.email) score += 5;

  if (c.provinces.length && l.province && !c.provinces.includes(l.province)) {
    reasons.push(`Provincia ${l.province} fuera de la zona del ${c.vertical === "placas" ? "instalador" : "cliente"}`);
    if (c.vertical === "placas") fails.push("Fuera de la zona del instalador");
    else score -= 10;
  }

  score = Math.max(0, Math.min(100, score));
  if (fails.length) return { score: Math.min(score, 20), status: "no_cualificado", reasons: [...fails, ...reasons] };
  if (bill == null) return { score, status: "pendiente", reasons };
  return { score, status: score >= 55 ? "cualificado" : "dudoso", reasons };
}

// ---------------- Oportunidades ----------------

export const DEAL_STAGES: Record<"luz" | "placas", string[]> = {
  luz: ["estudio", "oferta_enviada", "firmado", "activado", "perdido"],
  placas: ["enviado", "aceptado", "rechazado", "visita", "presupuesto", "firmado", "perdido"],
};
export const FIRST_STAGE = { luz: "estudio", placas: "enviado" } as const;

export const DEAL_STAGE: Record<string, { label: string; tone: Tone; hint: string }> = {
  estudio: { label: "Estudio", tone: "blue", hint: "Pedir la factura y preparar la oferta" },
  oferta_enviada: { label: "Oferta enviada", tone: "violet", hint: "Esperando que la firme" },
  firmado: { label: "Firmado", tone: "fuchsia", hint: "Contrato u obra firmada" },
  activado: { label: "Activado", tone: "emerald", hint: "Suministro activo: se cobra la comisión" },
  enviado: { label: "Enviado al instalador", tone: "blue", hint: "Tiene unas horas para aceptarlo o rechazarlo" },
  aceptado: { label: "Aceptado", tone: "indigo", hint: "El instalador se queda el lead: se cobra" },
  rechazado: { label: "Rechazado", tone: "slate", hint: "El instalador no lo quiere: no se cobra" },
  visita: { label: "Visita", tone: "violet", hint: "Visita técnica agendada" },
  presupuesto: { label: "Presupuesto", tone: "amber", hint: "Presupuesto entregado" },
  perdido: { label: "Perdido", tone: "rose", hint: "No sale adelante" },
};

/** Etapas a las que se puede pasar desde una etapa (el equipo puede corregir a cualquiera). */
export function nextStages(vertical: "luz" | "placas", stage: string): string[] {
  const flow: Record<string, string[]> = {
    estudio: ["oferta_enviada", "perdido"],
    oferta_enviada: ["firmado", "perdido"],
    firmado: vertical === "luz" ? ["activado", "perdido"] : [],
    activado: [],
    enviado: ["aceptado", "rechazado"],
    aceptado: ["visita", "presupuesto", "perdido"],
    visita: ["presupuesto", "perdido"],
    presupuesto: ["firmado", "perdido"],
    rechazado: [],
    perdido: [],
  };
  return flow[stage] ?? [];
}

/** Un lead de placas sin respuesta del instalador se da por aceptado pasado su plazo. */
export function autoAccepted(createdAt: Date, acceptHours: number, now: Date) {
  return now.getTime() - createdAt.getTime() >= acceptHours * 3600_000;
}

// ---------------- Cobro ----------------

export type EnergyBillingInput = {
  vertical: "luz" | "placas";
  price_per_lead: number | null;
  price_per_sale: number | null;
  sale_commission_pct: number | null;
  leads_aceptados: number;      // placas: aceptados este mes
  ventas: number;               // luz: contratos activados · placas: obras firmadas
  importe_obras: number;        // placas: suma de obras firmadas este mes
};

/** Parte variable del mes de un cliente de energía. */
export function energyVariable(b: EnergyBillingInput) {
  const porLeads = b.vertical === "placas" ? b.leads_aceptados * (b.price_per_lead ?? 0) : 0;
  const porVentas = b.ventas * (b.price_per_sale ?? 0);
  const porComision = b.vertical === "placas" ? Math.round(b.importe_obras * (b.sale_commission_pct ?? 0)) / 100 : 0;
  return { porLeads, porVentas, porComision, total: porLeads + porVentas + porComision };
}

// ---------------- Formularios ----------------

export type EnergyLeadData = {
  interest?: string | null;
  business_type?: string | null;
  postal_code?: string | null;
  monthly_bill?: number | null;
  tariff?: string | null;
  contracted_power_kw?: number | null;
  current_supplier?: string | null;
  roof?: string | null;
  daytime_share?: number | null;
  estimated_saving?: number | null;
  summary?: string | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = String(v).replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
const txt = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

/** "70 %", "0,7", "la mayoría de día" → 0-100. */
export function parseShare(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).toLowerCase();
  if (/mayor|casi todo|sobre todo de dia|de dia/.test(s) && !/\d/.test(s)) return 70;
  if (/noche|tarde/.test(s) && !/\d/.test(s)) return 30;
  const n = num(v);
  if (n == null) return null;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Limpia los campos de energía que mande la web o n8n (con nombres exactos o aproximados). */
export function cleanEnergyData(src: Record<string, unknown>): EnergyLeadData {
  const out: EnergyLeadData = {};
  for (const [k, v] of Object.entries(src)) {
    if (v === null || v === undefined || v === "") continue;
    const key = k.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-?¿]/g, " ").trim();
    if (/^interest$|interes/.test(key)) out.interest = txt(v);
    else if (/business|negocio|actividad|sector/.test(key)) out.business_type = txt(v);
    else if (/postal|^cp$|zip/.test(key)) out.postal_code = (String(v).match(/\d{5}/) ?? [null])[0];
    else if (/bill|factura|gasto|pagas/.test(key)) out.monthly_bill = num(v);
    else if (/tariff|tarifa|peaje/.test(key)) out.tariff = parseTariff(v);
    else if (/power|potencia/.test(key)) out.contracted_power_kw = num(v);
    else if (/supplier|comercializadora|compania/.test(key)) out.current_supplier = txt(v);
    else if (/roof|cubierta|tejado/.test(key)) out.roof = parseRoof(v);
    else if (/daytime|de dia|horas de sol|diurno/.test(key)) out.daytime_share = parseShare(v);
    else if (/saving|ahorro/.test(key)) out.estimated_saving = num(v);
    else if (/summary|resumen|analisis/.test(key)) out.summary = txt(v);
  }
  return out;
}
