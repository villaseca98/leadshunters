// Segunda línea de negocio: afiliación de luz y placas solares (Recorta).
// Los leads llegan por Instagram (ManyChat) u otro bot y se trabajan en el CRM, separados de los despachos.

import { parseMoney } from "./normalize";
import type { Tone } from "./labels";

export type Vertical = "despachos" | "luz" | "placas";
export type EnergyVertical = Exclude<Vertical, "despachos">;

export const VERTICALS: Record<Vertical, { label: string; short: string }> = {
  despachos: { label: "Despachos (Segunda Oportunidad)", short: "Despachos" },
  luz: { label: "Luz (ahorro en la factura)", short: "Luz" },
  placas: { label: "Placas solares", short: "Placas" },
};

const strip = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "luz", "factura de la luz", "placas", "solar", "deudas"… -> vertical. Vacío -> null. */
export function parseVertical(input: unknown): Vertical | null {
  const s = strip(input);
  if (!s) return null;
  if (/placa|solar|fotovolt|autoconsumo|panel/.test(s)) return "placas";
  if (/luz|electric|factura|energia|tarifa|gas/.test(s)) return "luz";
  if (/despacho|deuda|lso|segunda|abogad/.test(s)) return "despachos";
  return null;
}

export const PROPERTY: Record<string, string> = {
  casa: "Casa o chalet",
  adosado: "Adosado",
  piso: "Piso",
  negocio: "Negocio o nave",
  otro: "Otro",
};

export function parseProperty(input: unknown): string | null {
  const s = strip(input);
  if (!s) return null;
  if (/adosad|pareado/.test(s)) return "adosado";
  if (/casa|chalet|unifamiliar|independiente|finca|campo/.test(s)) return "casa";
  if (/piso|apartament|atico|duplex|comunidad|bloque/.test(s)) return "piso";
  if (/negocio|nave|local|empresa|oficina|industri|comercio|tienda/.test(s)) return "negocio";
  return "otro";
}

/** Opciones de botón para ManyChat (vale el texto, el valor o el número de opción). */
export const BILL_OPTIONS = [
  { label: "Menos de 50 €", value: "40" },
  { label: "Entre 50 y 100 €", value: "75" },
  { label: "Entre 100 y 200 €", value: "150" },
  { label: "Más de 200 €", value: "250" },
];
export const PROPERTY_OPTIONS = ["Casa o chalet", "Adosado", "Piso", "Negocio o nave"];

export function parseBill(input: unknown): number | null {
  const s = strip(input);
  if (!s) return null;
  const opt = BILL_OPTIONS.find((o) => strip(o.label) === s || o.value === s) ?? (/^[1-4]$/.test(s) ? BILL_OPTIONS[Number(s) - 1] : undefined);
  if (opt) return Number(opt.value);
  const n = parseMoney(input);
  return n != null && n >= 0 && n < 100000 ? n : null;
}

export function parsePropertyOption(input: unknown): string | null {
  const s = strip(input);
  if (/^[1-4]$/.test(s)) return parseProperty(PROPERTY_OPTIONS[Number(s) - 1]);
  return parseProperty(input);
}

export function parseCustomerType(input: unknown, property?: string | null): "hogar" | "negocio" {
  const s = strip(input);
  if (/negocio|empresa|autonom|local|nave|comercio/.test(s)) return "negocio";
  if (!s && property === "negocio") return "negocio";
  return "hogar";
}

export type EnergyFields = {
  vertical: EnergyVertical;
  monthly_bill: number | null;
  property_type: string | null;
  owner: boolean | null;
  customer_type: "hogar" | "negocio";
};

/**
 * Prioridad para llamar primero a quien más puede ahorrar (y más comisión deja).
 * Luz: cuanto más alta la factura, mejor. Placas: casa propia y factura alta; un piso o un inquilino casi nunca cierra.
 */
export function energyPriority(f: EnergyFields): { tier: "A" | "B" | "C"; reasons: string[] } {
  const reasons: string[] = [];
  const bill = f.monthly_bill;
  if (f.vertical === "luz") {
    if (bill == null) return { tier: "B", reasons: ["Sin dato de factura"] };
    reasons.push(`Factura de unos ${Math.round(bill)} €/mes`);
    if (f.customer_type === "negocio") reasons.push("Negocio: más consumo");
    if (bill >= 100 || (f.customer_type === "negocio" && bill >= 50)) return { tier: "A", reasons };
    return { tier: bill >= 50 ? "B" : "C", reasons };
  }
  if (f.owner === false) return { tier: "C", reasons: ["No es propietario"] };
  if (f.property_type === "piso") return { tier: "C", reasons: ["Piso: depende de la comunidad"] };
  if (f.property_type) reasons.push(PROPERTY[f.property_type] ?? f.property_type);
  if (f.owner) reasons.push("Propietario");
  if (bill != null) reasons.push(`Factura de unos ${Math.round(bill)} €/mes`);
  const goodHome = f.property_type === "casa" || f.property_type === "adosado" || f.property_type === "negocio";
  if (goodHome && (bill ?? 0) >= 80) return { tier: "A", reasons };
  if (bill != null && bill < 50) return { tier: "C", reasons: [...reasons, "Poco consumo: amortiza tarde"] };
  return { tier: "B", reasons };
}

export const ENERGY_BRAND = "Recorta";

export const ENERGY_CONSENT_TEXT = (v: EnergyVertical, brand = ENERGY_BRAND) =>
  v === "luz"
    ? `Acepto la política de privacidad y que ${brand} o una comercializadora colaboradora me contacte por teléfono, WhatsApp o email para darme un estudio de ahorro en mi factura de la luz.`
    : `Acepto la política de privacidad y que ${brand} o un instalador colaborador me contacte por teléfono, WhatsApp o email para darme un estudio de placas solares.`;

export const ENERGY_STATUS: Record<string, { label: string; tone: Tone }> = {
  nuevo: { label: "Nuevo", tone: "blue" },
  no_contesta: { label: "No contesta", tone: "amber" },
  contactado: { label: "Contactado", tone: "indigo" },
  estudio_enviado: { label: "Estudio enviado", tone: "violet" },
  contratado: { label: "Contratado", tone: "emerald" },
  descartado: { label: "Descartado", tone: "slate" },
};

export const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  A: { label: "Prioridad A", tone: "emerald" },
  B: { label: "Prioridad B", tone: "amber" },
  C: { label: "Prioridad C", tone: "slate" },
};

export const LOST_REASONS = ["No le interesa", "Ya tiene buena tarifa", "No es el titular", "Inquilino / piso", "Precio de la instalación", "No contesta nunca", "Otro"];
