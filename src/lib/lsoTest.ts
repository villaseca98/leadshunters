// Test público "¿Puedo cancelar mis deudas?" para particulares.
// La persona lo rellena desde un anuncio, da su consentimiento y el lead entra cualificado en la cola.

import type { LeadFields } from "./normalize";

export type Option = { label: string; value: string };
export type Question = { id: keyof TestAnswers; title: string; hint?: string; options: Option[] };

export type TestAnswers = {
  debt: string;
  creditors: string;
  can_pay?: string;
  public_debt?: string;
  special_debt?: string;
  income: string;
  employment: string;
  home: string;
  blockers: string;
};

// Requisitos y excepciones según el Texto Refundido de la Ley Concursal tras la Ley 16/2022:
// insolvencia (art. 2), buena fe (art. 487), plazos para repetir (art. 488) y deudas no exonerables (art. 489).
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
    id: "can_pay",
    title: "¿Puedes pagar tus cuotas cada mes?",
    options: [
      { label: "Sí, sin problema", value: "si" },
      { label: "Pago, pero pidiendo más dinero o sin llegar a fin de mes", value: "justo" },
      { label: "No, ya tengo impagos o embargos", value: "no" },
    ],
  },
  {
    id: "public_debt",
    title: "¿Cuánto de lo que debes es con Hacienda, la Seguridad Social o el ayuntamiento?",
    hint: "La ley solo cancela una parte de estas deudas.",
    options: [
      { label: "Nada o casi nada", value: "nada" },
      { label: "Menos de la mitad", value: "menos" },
      { label: "Más de la mitad", value: "mas" },
      { label: "Casi todo", value: "casi_todo" },
    ],
  },
  {
    id: "special_debt",
    title: "¿Alguna de tus deudas es de estos tipos?",
    options: [
      { label: "Ninguna", value: "ninguna" },
      { label: "Pensión de alimentos", value: "alimentos" },
      { label: "Indemnización por un delito o por daños a personas", value: "indemnizacion" },
      { label: "Multas penales o sanciones muy graves", value: "multas" },
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
    hint: "Si te pasa más de una, elige la primera de la lista.",
    options: [
      { label: "Ninguna", value: "ninguna" },
      { label: "Me cancelaron deudas con esta ley hace menos de 2 años", value: "lso_2" },
      { label: "Me cancelaron deudas con esta ley hace entre 2 y 5 años", value: "lso_5" },
      { label: "Condena firme por un delito económico en los últimos 10 años", value: "condena" },
      { label: "Sanción muy grave de Hacienda o Seguridad Social sin pagar", value: "sancion" },
      { label: "Un concurso de acreedores mío o de mi empresa se declaró culpable", value: "culpable" },
    ],
  },
];

/** Preguntas añadidas en octubre de 2026: los bots e integraciones anteriores pueden no enviarlas. */
export const OPTIONAL_ANSWERS: (keyof TestAnswers)[] = ["can_pay", "public_debt", "special_debt"];

/** Códigos antiguos que siguen llegando de integraciones (ManyChat…). */
export const LEGACY_VALUES: Partial<Record<keyof TestAnswers, Record<string, string>>> = {
  blockers: { lso_previa: "lso_5" },
};

export function answersToFields(a: TestAnswers): Omit<LeadFields, "full_name" | "phone" | "email" | "province"> {
  return {
    debt_amount: Number(a.debt) || null,
    creditors_count: Number(a.creditors) || null,
    monthly_income: a.income === "" ? null : Number(a.income),
    employment_status: a.employment || null,
    owns_home: a.home === "si" ? true : a.home === "no" ? false : null,
    // Entre 2 y 5 años depende de si fue con plan de pagos (2) o con liquidación (5): lo revisa el abogado
    prior_lso: a.blockers === "lso_2" ? true : a.blockers === "lso_5" ? null : false,
    criminal_record: a.blockers === "condena",
  };
}

export type Verdict = { kind: "apto" | "revisar" | "no_apto"; title: string; text: string };

const NOT_CANCELLED: Record<string, string> = {
  alimentos: "La pensión de alimentos no se cancela nunca: tendrás que seguir pagándola.",
  indemnizacion: "Las indemnizaciones por delito o por daños a personas no se cancelan: tendrás que seguir pagándolas.",
  multas: "Las multas penales y las sanciones muy graves no se cancelan: tendrás que seguir pagándolas.",
};

/** Resultado orientativo para la persona. No es asesoramiento: lo confirma el abogado y, al final, decide el juez. */
export function evaluateTest(a: TestAnswers): Verdict {
  const v = baseVerdict(a);
  const note = a.special_debt ? NOT_CANCELLED[a.special_debt] : undefined;
  return note ? { ...v, text: `${v.text} ${note}` } : v;
}

function baseVerdict(a: TestAnswers): Verdict {
  const f = answersToFields(a);
  if (a.blockers === "lso_2") {
    return {
      kind: "no_apto",
      title: "Todavía no puedes volver a pedirla",
      text: "Tras cancelar deudas con esta ley hay que esperar al menos 2 años (si fue con plan de pagos) o 5 años (si fue vendiendo tus bienes). Un abogado puede mirar si hay otras salidas, como negociar con tus acreedores.",
    };
  }
  if (a.blockers === "condena" || a.blockers === "culpable") {
    return {
      kind: "no_apto",
      title: "Tu caso necesita una revisión especial",
      text: a.blockers === "condena"
        ? "Una condena firme por delitos económicos en los últimos 10 años impide la Segunda Oportunidad, salvo que la pena esté cumplida y pagadas las responsabilidades. Un abogado puede comprobar si es tu caso."
        : "Si tu propio concurso se declaró culpable, la ley no permite cancelar las deudas. Si fue el de tu empresa, depende de si te declararon persona afectada y de si pagaste. Un abogado lo revisa contigo.",
    };
  }
  if (a.blockers === "sancion") {
    return {
      kind: "revisar",
      title: "Puede que sí, pero hay un obstáculo",
      text: "Una sanción muy grave de Hacienda o de la Seguridad Social en los últimos 10 años impide la Segunda Oportunidad, salvo que la hayas pagado entera. Un abogado te dirá cómo resolverlo.",
    };
  }
  if (a.blockers === "lso_5") {
    return {
      kind: "revisar",
      title: "Depende de cómo fue la primera vez",
      text: "Si la primera vez fue con plan de pagos, ya puedes volver a pedirla; si fue vendiendo tus bienes, hay que esperar 5 años. Esta vez no se cancelaría nada de lo que debas a Hacienda o la Seguridad Social.",
    };
  }
  if (a.can_pay === "si") {
    return {
      kind: "revisar",
      title: "Puede que no la necesites",
      text: "La ley es para quien no puede pagar sus deudas. Si llegas a todo, un abogado puede proponerte otras opciones, como renegociar o reclamar intereses abusivos.",
    };
  }
  if ((f.creditors_count ?? 0) < 2 || (f.debt_amount ?? 0) < 8000) {
    return {
      kind: "revisar",
      title: "Puede que sí, hay que revisarlo",
      text: (f.creditors_count ?? 0) < 2
        ? "En la práctica los juzgados piden deber a dos o más acreedores. Mucha gente tiene más de los que cree (tarjetas, Hacienda, Seguridad Social). Un abogado lo revisa contigo."
        : "Con deudas pequeñas a veces compensa más negociar que ir a la Segunda Oportunidad. Un abogado te dirá qué te sale mejor.",
    };
  }
  if (a.public_debt === "casi_todo" || a.public_debt === "mas") {
    return {
      kind: "revisar",
      title: "Puede que sí, aunque solo en parte",
      text: "De lo que debes a cada administración (Hacienda, Seguridad Social, ayuntamiento) se cancelan los primeros 5.000 € y la mitad del resto, con un máximo de 10.000 €. Los recargos e intereses sí se pueden cancelar. Un abogado calculará cuánto te quedaría.",
    };
  }
  return {
    kind: "apto",
    title: "Tu caso encaja con los requisitos básicos",
    text: "Por lo que nos cuentas, podrías acogerte a la Ley de Segunda Oportunidad. Un abogado colegiado lo revisará contigo y te dirá qué deudas se cancelarían. La decisión final es siempre del juez.",
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
