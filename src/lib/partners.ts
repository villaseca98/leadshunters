// Partners: gestorías, administradores de fincas… que recomiendan una marca (Recorta) con su enlace ?p=CODIGO
// y se llevan un % de la comisión de cada lead ganado. Aquí solo lógica pura (sin base de datos), para poder probarla.
import type { Tone } from "./labels";

export const PARTNER_KINDS = {
  gestoria: "Gestoría o asesoría",
  administrador: "Administrador de fincas",
  asociacion: "Asociación o gremio",
  instalador: "Instalador",
  otro: "Otro",
} as const;
export type PartnerKind = keyof typeof PARTNER_KINDS;

/** Lo que ve el partner de cada lead suyo (sin teléfono ni email). */
export const PARTNER_STATUS: Record<string, { label: string; tone: Tone }> = {
  nuevo: { label: "Recibido", tone: "blue" },
  no_contesta: { label: "Intentando contactar", tone: "amber" },
  contactado: { label: "En estudio", tone: "indigo" },
  propuesta: { label: "Oferta enviada", tone: "violet" },
  ganado: { label: "Contratado", tone: "emerald" },
  descartado: { label: "No sigue", tone: "slate" },
};

export function normalizeCode(input: unknown): string | null {
  const s = String(input ?? "").trim().toUpperCase();
  return /^[A-Z0-9-]{2,30}$/.test(s) ? s : null;
}

/** Código a partir del nombre: "Gestoría Pérez, S.L." → "GESTORIA-PEREZ". */
export function codeFromName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/\b(S\.?L\.?U?|S\.?A\.?|C\.?B\.?|SLP)\b\.?/g, " ")
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "");
  return base.length >= 2 ? base : "PARTNER";
}

export const shareOf = (value: number | null | undefined, pct: number) => Math.round((Number(value ?? 0) * pct) / 100 * 100) / 100;

/** Trimestre natural de una fecha: "2026-T4". */
export function quarterOf(d: Date | string): string {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-T${Math.floor(x.getUTCMonth() / 3) + 1}`;
}

export function quarterLabel(q: string) {
  const [y, t] = q.split("-T");
  return `${["", "enero–marzo", "abril–junio", "julio–septiembre", "octubre–diciembre"][Number(t)]} ${y}`;
}

/** Enlace que el partner da a sus clientes. */
export function partnerLink(base: string, code: string, path = "/revisar-factura/") {
  return `${base.replace(/\/$/, "")}${path}?p=${encodeURIComponent(code)}`;
}

/** "utm_source=x&utm_campaign=y" (lo que guarda la web) → objeto con solo las claves utm_*. */
export function parseUtm(input: unknown): Record<string, string> {
  if (input && typeof input === "object") input = new URLSearchParams(Object.entries(input as Record<string, string>)).toString();
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(String(input ?? ""))) if (/^utm_[a-z]+$/.test(k) && v) out[k] = v.slice(0, 120);
  return out;
}

/** Lo que paga de luz al mes → valor de la pregunta "factura" de las líneas de luz y placas. */
export function billBucket(input: unknown): string | null {
  const n = Number(String(input ?? "").replace(/[^\d,.]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 50 ? "40" : n < 100 ? "75" : n < 200 ? "150" : "250";
}

export type WebForm = Record<string, unknown>;
export type WebPlan =
  | { kind: "spam" }
  | { kind: "partner"; name: string; partnerKind: PartnerKind; phone: string | null; email: string | null; notes: string }
  | { kind: "leads"; forms: string[]; body: Record<string, unknown> }
  | { kind: "invalid"; error: string };

/**
 * Formulario de la web de Recorta (los mismos campos que recibe n8n) → qué hacer con él.
 * luz, placas o luz+placas = un lead por línea (recorta-luz, recorta-placas); instaladores y gestorías que quieren colaborar = solicitud de partner.
 */
export function planWebForm(f: WebForm, brand = "recorta"): WebPlan {
  const s = (k: string) => (f[k] == null ? "" : String(f[k]).trim());
  if (s("web")) return { kind: "spam" };
  if (!(f.consentimiento === true || /^(si|sí|true|on|1)$/i.test(s("consentimiento")))) return { kind: "invalid", error: "Falta el consentimiento." };
  if (s("nombre").length < 2) return { kind: "invalid", error: "Falta el nombre." };
  const tipo = s("tipo");
  const interes = s("interes").toLowerCase();
  if (interes === "colaborar" || tipo === "instalador" || tipo === "profesional") {
    return {
      kind: "partner",
      name: s("nombre").slice(0, 120),
      partnerKind: tipo === "instalador" ? "instalador" : "gestoria",
      phone: s("telefono") || null,
      email: s("email") || null,
      notes: [s("sector") && `${tipo === "instalador" ? "Zona" : "Cartera"}: ${s("sector")}`, s("codigoPostal") && `CP ${s("codigoPostal")}`, s("pagina") && `Desde ${s("pagina")}`]
        .filter(Boolean).join(" · ").slice(0, 400),
    };
  }
  const forms = [interes.includes("luz") && `${brand}-luz`, interes.includes("placas") && `${brand}-placas`].filter(Boolean) as string[];
  if (!forms.length) forms.push(`${brand}-luz`);
  const utm = parseUtm(f.utm);
  const body: Record<string, unknown> = {
    source: "web",
    full_name: s("nombre"),
    phone: s("telefono"),
    email: s("email") || undefined,
    postal_code: s("codigoPostal") || undefined,
    business_type: s("sector") || undefined,
    factura: billBucket(f.facturaMensual) ?? undefined,
    factura_mensual: s("facturaMensual") || undefined,
    resumen: s("resumen") || undefined,
    ahorro_anual: s("ahorroAnual") || undefined,
    pagina: s("pagina") || undefined,
    campaign: utm.utm_campaign ? `web-${utm.utm_campaign}` : undefined,
    utm,
    partner: normalizeCode(f.partner) ?? undefined,
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  return { kind: "leads", forms, body };
}
