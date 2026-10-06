// Planes de servicio. Siempre cuota fija + precio por consulta realizada (nunca % de honorarios).
// La inversión en anuncios la paga el despacho aparte, directamente a Meta y Google.

export type PlanId = "esencial" | "completo" | "premium";

export const PLANS: Record<PlanId, { name: string; fee: number; perConsultation: number; exclusive: boolean; features: string[] }> = {
  esencial: {
    name: "Esencial",
    fee: 500,
    perConsultation: 40,
    exclusive: false,
    features: [
      "Anuncios en Meta (Facebook e Instagram) desde la página del despacho",
      "Test de cualificación con el nombre del despacho",
      "Llamada a cada interesado en menos de 5 minutos",
      "Consulta agendada en su agenda con el resumen del caso",
    ],
  },
  completo: {
    name: "Completo",
    fee: 900,
    perConsultation: 35,
    exclusive: false,
    features: [
      "Todo lo del plan Esencial",
      "Anuncios en Google Search",
      "Gestión de su Instagram: 12 publicaciones al mes",
      "Recordatorios y recuperación de quien no se presenta",
      "Reactivación de sus leads antiguos",
      "Informe mensual de resultados",
    ],
  },
  premium: {
    name: "Premium",
    fee: 1400,
    perConsultation: 30,
    exclusive: true,
    features: [
      "Todo lo del plan Completo",
      "Asistente de WhatsApp que atiende 24 horas",
      "Petición automática de reseñas en Google",
      "Exclusividad en su provincia: no trabajamos con su competencia",
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
export const planName = (id: string | null | undefined) => (id && id in PLANS ? PLANS[id as PlanId].name : "Personalizado");

/** Cómo funciona el servicio, paso a paso (auditoría y documento de venta). */
export const STEPS: { title: string; text: string }[] = [
  { title: "Captamos", text: "Anuncios en Meta y Google dirigidos a personas con deudas de tu zona, publicados desde la página de tu despacho." },
  { title: "Cualificamos", text: "Cada interesado hace un test de 6 preguntas (deuda, acreedores, ingresos, vivienda…) y da su consentimiento." },
  { title: "Llamamos en menos de 5 minutos", text: "Nuestro equipo le llama al momento en horario de atención (L-V 9-21 h, S 10-14 h) y hasta 7 veces en 6 días si no contesta." },
  { title: "Agendamos", text: "Si encaja con tus criterios, la consulta entra en tu agenda y te llega un email con el resumen del caso." },
  { title: "Recordamos", text: "El interesado recibe un recordatorio antes de la cita para que no falte." },
  { title: "Confirmas con un clic", text: "Después de la consulta marcas desde el email si se realizó." },
  { title: "Pagas solo lo realizado", text: "A fin de mes, cuota fija más las consultas realizadas, con un justificante de cada una." },
];

export const GUARANTEES: { title: string; text: string }[] = [
  { title: "Solo pagas consultas que se realizan", text: "Si el interesado no se presenta o cancela, no se cobra." },
  { title: "Llamada en menos de 5 minutos", text: "Si en horario de atención tardamos más y ese lead acaba en consulta, esa consulta es gratis." },
  { title: "Garantía de arranque", text: "Si en los primeros 45 días no te agendamos al menos 5 consultas cualificadas, el mes siguiente no pagas la cuota fija (con una inversión en anuncios de al menos 600 €/mes)." },
  { title: "Leads exclusivos", text: "Cada interesado va solo a tu despacho. Nunca lo revendemos a otro." },
  { title: "Sin permanencia", text: "Mes a mes, con 15 días de aviso. En Premium, mínimo 3 meses por la exclusividad provincial." },
  { title: "Datos en regla", text: "Todos los interesados dan su consentimiento por escrito (RGPD) y quedan registrados." },
];

export const TIMELINE: { when: string; text: string }[] = [
  { when: "Día 1", text: "Videollamada de 15 minutos y alta. Nos das acceso de anunciante a tu página de Facebook y tu agenda." },
  { when: "Días 2-3", text: "Preparamos tu test con tu nombre, los anuncios y tu cola de llamadas." },
  { when: "Días 3-5", text: "Anuncios publicados." },
  { when: "Semanas 1-2", text: "Primeros interesados y primeras consultas en tu agenda." },
  { when: "Semana 2", text: "Completo y Premium: Google Ads y tu Instagram en marcha." },
  { when: "Día 30", text: "Primer informe y ajuste de anuncios según el coste por consulta." },
  { when: "Meses 2-3", text: "Campañas optimizadas y coste por consulta estable." },
];

/** Lo que le pasa hoy a un despacho de Segunda Oportunidad sin un sistema de captación. */
export const PROBLEMS: { title: string; text: string }[] = [
  { title: "Los leads se enfrían en minutos", text: "Quien tiene deudas rellena varios formularios. Gana el despacho que llama primero, y casi nadie llama en menos de una hora." },
  { title: "No hay tiempo para llamar", text: "Los abogados están en juzgados y consultas. Los interesados de noche y en fin de semana se pierden." },
  { title: "Muchas consultas no encajan", text: "Deudas pequeñas, un solo acreedor o casos que la ley no cubre hacen perder horas de abogado." },
  { title: "El boca a boca no da estabilidad", text: "Un mes entran diez casos y el siguiente dos." },
];

/** Comparativa de planes: [concepto, esencial, completo, premium]. */
export const COMPARE: [string, boolean | string, boolean | string, boolean | string][] = [
  ["Anuncios en Meta desde tu página", true, true, true],
  ["Test con el nombre del despacho", true, true, true],
  ["Llamada en menos de 5 minutos", true, true, true],
  ["Consulta en tu agenda con resumen", true, true, true],
  ["Anuncios en Google Search", false, true, true],
  ["Tu Instagram: 12 publicaciones/mes", false, true, true],
  ["Recordatorios y recuperar ausencias", false, true, true],
  ["Reactivar tus leads antiguos", false, true, true],
  ["Informe mensual", false, true, true],
  ["Asistente de WhatsApp 24 h", false, false, true],
  ["Reseñas automáticas en Google", false, false, true],
  ["Exclusividad en tu provincia", false, false, true],
  ["Permanencia mínima", "No", "No", "3 m"],
];

export const FAQ: { q: string; a: string }[] = [
  { q: "¿Por qué no cobráis un porcentaje de lo que facture el despacho?", a: "Porque el código deontológico lo limita. Somos un servicio de marketing: cuota fija y un precio cerrado por consulta realizada." },
  { q: "Ya tengo una agencia que me hace anuncios.", a: "La diferencia está en lo que pasa después del anuncio: llamamos en menos de 5 minutos, filtramos y solo te llega la consulta cualificada a tu agenda." },
  { q: "¿Y si los leads no son buenos?", a: "Tú fijas los criterios (deuda mínima, acreedores, provincias) y solo pagas las consultas que se realizan." },
  { q: "¿Cuánto tengo que invertir en anuncios?", a: "Recomendamos al menos 600 €/mes, pagados directamente a Meta y Google desde tu cuenta. Así siempre ves en qué se gasta." },
  { q: "¿Tengo que tener Instagram?", a: "No. Los anuncios salen desde la página de Facebook del despacho, también en Instagram. En el plan Completo te lo gestionamos si lo tienes." },
  { q: "¿Qué pasa con los datos de los interesados?", a: "Cada persona da su consentimiento en el test a nombre de tu despacho. Nosotros actuamos como tu equipo de atención." },
];

export const NEXT_STEPS = [
  "Videollamada de 15 minutos para ver tu caso",
  "Eliges plan y criterios de cualificación",
  "Nos das acceso de anunciante a tu página de Facebook y a tu agenda",
];
