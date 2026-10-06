// Test público "¿Puedo cancelar mis deudas?" para particulares.
// La persona lo rellena desde un anuncio, da su consentimiento y el lead entra cualificado en la cola.

import type { LeadFields } from "./normalize";

export type Option = { label: string; value: string };
export type Question = { id: keyof TestAnswers; title: string; hint?: string; options: Option[] };

export type TestAnswers = {
  debt: string;
  creditors: string;
  income: string;
  employment: string;
  home: string;
  blockers: string;
};

export const QUESTIONS: Question[] = [
  {
    id: "debt",
    title: "¿Cuánto debes en total, más o menos?",
    hint: "Suma préstamos, tarjetas, microcréditos, Hacienda, Seguridad Social…",
    options: [
      { label: "Menos de 8.000 €", value: "5000" },
      { label: "Entre 8.000 y 15.000 €", value: "11000" },
      { label: "Entre 15.000 y 30.000 €", value: "22000" },
      { label: "Entre 30.000 y 60.000 €", value: "45000" },
      { label: "Más de 60.000 €", value: "80000" },
    ],
  },
  {
    id: "creditors",
    title: "¿A cuántas entidades les debes dinero?",
    hint: "Bancos, financieras, tiendas, Hacienda, particulares…",
    options: [
      { label: "Solo a una", value: "1" },
      { label: "A dos", value: "2" },
      { label: "A tres o cuatro", value: "3" },
      { label: "A cinco o más", value: "5" },
    ],
  },
  {
    id: "income",
    title: "¿Cuánto ingresas al mes en casa?",
    options: [
      { label: "Ahora mismo nada", value: "0" },
      { label: "Menos de 1.000 €", value: "800" },
      { label: "Entre 1.000 y 1.500 €", value: "1250" },
      { label: "Entre 1.500 y 2.500 €", value: "2000" },
      { label: "Más de 2.500 €", value: "3000" },
    ],
  },
  {
    id: "employment",
    title: "¿Cuál es tu situación laboral?",
    options: [
      { label: "Trabajo por cuenta ajena", value: "asalariado" },
      { label: "Soy autónomo", value: "autonomo" },
      { label: "Estoy en paro", value: "desempleado" },
      { label: "Soy pensionista", value: "pensionista" },
    ],
  },
  {
    id: "home",
    title: "¿Tienes una vivienda en propiedad?",
    options: [
      { label: "No", value: "no" },
      { label: "Sí", value: "si" },
    ],
  },
  {
    id: "blockers",
    title: "¿Te pasa alguna de estas cosas?",
    options: [
      { label: "Ninguna", value: "ninguna" },
      { label: "Usé la Segunda Oportunidad hace menos de 5 años", value: "lso_previa" },
      { label: "Tengo condenas por delitos económicos", value: "condena" },
    ],
  },
];

export function answersToFields(a: TestAnswers): Omit<LeadFields, "full_name" | "phone" | "email" | "province"> {
  return {
    debt_amount: Number(a.debt) || null,
    creditors_count: Number(a.creditors) || null,
    monthly_income: a.income === "" ? null : Number(a.income),
    employment_status: a.employment || null,
    owns_home: a.home === "si" ? true : a.home === "no" ? false : null,
    prior_lso: a.blockers === "lso_previa",
    criminal_record: a.blockers === "condena",
  };
}

export type Verdict = { kind: "apto" | "revisar" | "no_apto"; title: string; text: string };

/** Resultado orientativo para la persona. No es asesoramiento: lo confirma el abogado en la consulta. */
export function evaluateTest(a: TestAnswers): Verdict {
  const f = answersToFields(a);
  if (f.prior_lso) {
    return {
      kind: "no_apto",
      title: "Ahora mismo la ley no te lo permite",
      text: "La Segunda Oportunidad solo se puede usar una vez cada 5 años. Un abogado puede revisar si hay otras salidas para tus deudas, como negociar con los acreedores.",
    };
  }
  if (f.criminal_record) {
    return {
      kind: "no_apto",
      title: "Tu caso necesita una revisión especial",
      text: "Las condenas por delitos económicos de los últimos 10 años pueden impedir la Segunda Oportunidad. Un abogado puede comprobar si te afecta.",
    };
  }
  if ((f.creditors_count ?? 0) < 2 || (f.debt_amount ?? 0) < 8000) {
    return {
      kind: "revisar",
      title: "Puede que sí, hay que revisarlo",
      text: (f.creditors_count ?? 0) < 2
        ? "La ley pide deber a dos o más acreedores. Mucha gente tiene más de los que cree (tarjetas, Hacienda, Seguridad Social). Un abogado lo revisa contigo."
        : "Con deudas pequeñas a veces compensa más negociar que ir a la Segunda Oportunidad. Un abogado te dirá qué te sale mejor.",
    };
  }
  return {
    kind: "apto",
    title: "Cumples los requisitos básicos",
    text: "Por lo que nos cuentas, podrías cancelar buena parte de tus deudas con la Ley de Segunda Oportunidad. Un abogado especialista lo confirmará en una consulta gratuita.",
  };
}

/** Origen del lead según los parámetros del anuncio. */
export function sourceFromUtm(utmSource?: string | null): "meta" | "google" | "web" {
  const s = (utmSource ?? "").toLowerCase();
  if (/facebook|instagram|^fb|^ig|meta/.test(s)) return "meta";
  if (/google|adwords|gads|youtube/.test(s)) return "google";
  return "web";
}

export const CONSENT_TEXT = (brand: string) =>
  `Acepto la política de privacidad y que ${brand} y un despacho de abogados colaborador de mi provincia me contacten por teléfono, WhatsApp o email para estudiar mi caso.`;

export const FIRM_CONSENT_TEXT = (firm: string) =>
  `Acepto la política de privacidad y que ${firm} me contacte, directamente o a través de su equipo de atención, por teléfono, WhatsApp o email para estudiar mi caso.`;
