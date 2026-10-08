// Leads Hunters es la matriz: varias empresas (Recorta…) con sus líneas de negocio (luz, placas…).
// Cada línea define sus propias preguntas; con sus puntos se calcula la prioridad A/B/C del lead.
// Despachos (Segunda Oportunidad) es la línea integrada y sigue usando sus tablas y su test de siempre.

import { parseBool, parseMoney } from "./normalize";
import type { Tone } from "./labels";

export type FieldOption = { label: string; value: string; points?: number };
export type LineField = {
  key: string;
  label: string;
  type: "select" | "number" | "text" | "bool";
  options?: FieldOption[];
  aliases?: string[];
  points_yes?: number;
  points_no?: number;
};

export type Line = {
  id: string;
  company_id: string;
  company_name: string;
  company_slug: string;
  slug: string;
  name: string;
  emoji: string;
  kind: "despachos" | "generica";
  keywords: string[];
  fields: LineField[];
  /** campos de la ficha de sus clientes (comercializadora, kWp, dominio…) */
  client_fields: LineField[];
  priority_a: number;
  priority_b: number;
  consent_text: string;
  thanks_text: string;
  proposal_label: string;
  won_label: string;
  value_label: string;
  default_value: number | null;
  active: boolean;
  position: number;
};

export const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const slugify = (s: string) =>
  norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Qué línea pide la persona: vale el slug ("luz"), el nombre ("Placas solares") o una palabra clave ("factura de la luz"). */
export function matchLine<T extends Pick<Line, "slug" | "name" | "keywords" | "active">>(input: unknown, lines: T[]): T | null {
  const s = norm(input);
  if (!s) return null;
  const active = lines.filter((l) => l.active);
  const exact = active.find((l) => l.slug === s || norm(l.name) === s || slugify(l.name) === slugify(s));
  if (exact) return exact;
  const hits = active
    .map((l) => ({ l, k: [l.slug, ...l.keywords].map(norm).filter(Boolean).filter((k) => s.includes(k)).sort((a, b) => b.length - a.length)[0] }))
    .filter((x) => x.k);
  // la palabra clave más larga gana ("placas solares" antes que "solar")
  hits.sort((a, b) => b.k!.length - a.k!.length);
  return hits[0]?.l ?? null;
}

/** Normaliza la respuesta a una pregunta: vale el texto del botón, su valor o su número (1, 2, 3…). */
export function readField(f: LineField, raw: unknown): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const s = norm(raw);
  if (f.type === "select") {
    const opts = f.options ?? [];
    const opt = opts.find((o) => norm(o.label) === s || norm(o.value) === s) ?? (/^\d{1,2}$/.test(s) ? opts[Number(s) - 1] : undefined)
      ?? opts.find((o) => s.length >= 3 && (norm(o.label).includes(s) || s.includes(norm(o.label))))
      ?? nearestNumeric(opts, raw);
    return opt ? opt.value : String(raw).trim().slice(0, 200);
  }
  if (f.type === "bool") {
    const b = parseBool(raw);
    return b == null ? String(raw).trim().slice(0, 50) : b ? "si" : "no";
  }
  if (f.type === "number") {
    const n = parseMoney(raw);
    return n == null ? null : String(n);
  }
  return String(raw).trim().slice(0, 500);
}

/** Un importe ("130", 130) en una pregunta de tramos con valores numéricos (40, 75, 150…): el tramo más cercano. */
function nearestNumeric(opts: FieldOption[], raw: unknown): FieldOption | undefined {
  const n = parseMoney(raw);
  if (n == null || !opts.length || !opts.every((o) => /^-?\d+(\.\d+)?$/.test(o.value))) return undefined;
  return opts.reduce((a, b) => (Math.abs(Number(b.value) - n) < Math.abs(Number(a.value) - n) ? b : a));
}

/** Campos comunes a todas las líneas: no van a "data". */
export const CORE_KEYS = new Set([
  "full_name", "nombre", "name", "first_name", "last_name", "phone", "telefono", "movil", "phone_number", "email", "correo",
  "province", "provincia", "consent", "acepto", "consentimiento", "marketing_ok", "canal", "campana", "linea", "vertical",
  "linea_negocio", "interes", "empresa", "api_key", "utm_source", "utm_medium", "utm_campaign", "utm_content",
]);

/** Saca de lo que manda ManyChat las respuestas de la línea y guarda también cualquier dato extra. */
export function extractData(fields: LineField[], body: Record<string, unknown>): Record<string, string> {
  const keys = Object.keys(body);
  const used = new Set<string>();
  const data: Record<string, string> = {};
  for (const f of fields) {
    const names = [f.key, ...(f.aliases ?? []), slugify(f.label).replace(/-/g, "_")].map(norm);
    const k = keys.find((x) => names.includes(norm(x)) && !used.has(x));
    if (!k) continue;
    used.add(k);
    const v = readField(f, body[k]);
    if (v != null) data[f.key] = v;
  }
  for (const k of keys) {
    if (used.has(k) || CORE_KEYS.has(norm(k)) || data[k] !== undefined) continue;
    const v = body[k];
    if (v === null || v === undefined || typeof v === "object") continue;
    const sv = String(v).trim();
    if (sv && !/^\{\{.*\}\}$/.test(sv)) data[k.slice(0, 40)] = sv.slice(0, 200);
  }
  return data;
}

/** Puntos de las respuestas -> prioridad A/B/C y los motivos para el telefonista. */
export function scoreLead(line: Pick<Line, "fields" | "priority_a" | "priority_b">, data: Record<string, string>) {
  let points = 0;
  let answered = 0;
  const reasons: string[] = [];
  for (const f of line.fields) {
    const v = data[f.key];
    if (v == null) continue;
    let p = 0;
    if (f.type === "select") p = f.options?.find((o) => o.value === v)?.points ?? 0;
    else if (f.type === "bool") p = v === "si" ? f.points_yes ?? 0 : v === "no" ? f.points_no ?? 0 : 0;
    if (f.type === "select" || f.type === "bool") answered++;
    points += p;
    if (p !== 0 || f.type === "select") reasons.push(`${f.label}: ${displayValue(f, v)}${p ? ` (${p > 0 ? "+" : ""}${p})` : ""}`);
  }
  const scored = line.fields.some((f) => f.type === "select" || f.type === "bool");
  if (scored && answered === 0) return { tier: "B" as const, points, reasons: ["Sin respuestas para puntuar"] };
  const tier = points >= line.priority_a ? "A" : points >= line.priority_b ? "B" : "C";
  return { tier: tier as "A" | "B" | "C", points, reasons };
}

export function displayValue(f: LineField | undefined, v: string | null | undefined): string {
  if (v == null || v === "") return "—";
  if (!f) return v;
  if (f.type === "select") return f.options?.find((o) => o.value === v)?.label ?? v;
  if (f.type === "bool") return v === "si" ? "Sí" : v === "no" ? "No" : v;
  return v;
}

export const LINE_STATUSES = ["nuevo", "no_contesta", "contactado", "propuesta", "ganado", "descartado"] as const;
export type LineStatus = (typeof LINE_STATUSES)[number];

export function statusMap(line?: Pick<Line, "proposal_label" | "won_label">): Record<string, { label: string; tone: Tone }> {
  return {
    nuevo: { label: "Nuevo", tone: "blue" },
    no_contesta: { label: "No contesta", tone: "amber" },
    contactado: { label: "Contactado", tone: "indigo" },
    propuesta: { label: line?.proposal_label || "Propuesta enviada", tone: "violet" },
    ganado: { label: line?.won_label || "Cerrado", tone: "emerald" },
    descartado: { label: "Descartado", tone: "slate" },
  };
}

export const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  A: { label: "Prioridad A", tone: "emerald" },
  B: { label: "Prioridad B", tone: "amber" },
  C: { label: "Prioridad C", tone: "slate" },
};

export const LOST_REASONS = ["No le interesa", "Ya tiene algo mejor", "No es quien decide", "No cumple requisitos", "Precio", "No contesta nunca", "Otro"];

/**
 * Preguntas desde el formulario de ajustes. Opciones separadas por comas, con puntos opcionales:
 * "Casa o chalet=2, Piso=-5, Negocio" -> 3 opciones.
 */
export function parseOptions(text: string, previous: FieldOption[] = []): FieldOption[] {
  // si la opción ya existía (mismo texto), conserva su valor para no romper los leads que ya la tienen
  const keep = new Map(previous.map((o) => [norm(o.label), o.value]));
  return text
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)(?:\s*=\s*([+-]?\d+))?$/);
      const label = (m?.[1] ?? s).trim();
      const value = keep.get(norm(label)) ?? (slugify(label).replace(/-/g, "_") || label);
      return m?.[2] != null ? { label, value, points: Number(m[2]) } : { label, value };
    });
}

export const optionsText = (opts?: FieldOption[]) => (opts ?? []).map((o) => (o.points ? `${o.label}=${o.points}` : o.label)).join(", ");

/** Cuerpo de ejemplo para la "External Request" de ManyChat de esta línea. */
export function manychatBody(line: Pick<Line, "slug" | "fields">): string {
  const o: Record<string, string> = { linea: line.slug, nombre: "{{full_name}}", telefono: "{{telefono}}", provincia: "{{provincia}}" };
  for (const f of line.fields) o[f.key] = `{{${f.key}}}`;
  Object.assign(o, { acepto: "si", canal: "instagram", campana: `reel-${line.slug}` });
  return JSON.stringify(o, null, 1).replace(/\n\s*/g, " ");
}
