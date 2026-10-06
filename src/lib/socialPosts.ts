// Banco de publicaciones de Instagram para cada despacho (plan Completo y Premium: 12 al mes).
// Textos informativos y prudentes: nunca prometer resultados, el abogado decide cada caso.
// Cada mes se eligen 12 del banco rotando, para no repetir los mismos meses seguidos.

export type PostKind = "carrusel" | "reel" | "historia";
export type PostIdea = { kind: PostKind; title: string; slides: string[]; caption: string };

type Ctx = { firm: string; place: string; link: string };

const BANK: ((c: Ctx) => PostIdea)[] = [
  (c) => ({ kind: "carrusel", title: "¿Qué es la Ley de Segunda Oportunidad?", slides: [
    "¿Qué es la Ley de Segunda Oportunidad?", "Es una ley de 2015 que permite a particulares y autónomos cancelar deudas que no pueden pagar.",
    "No es un préstamo ni una reunificación: es un procedimiento judicial.", "Si se cumplen los requisitos, el juez puede exonerar las deudas pendientes.",
    `¿Quieres saber si es tu caso? Escríbenos. ${c.firm}`],
    caption: `La Ley de Segunda Oportunidad existe desde 2015 y ya ha ayudado a miles de familias a empezar de cero. Te lo explicamos en 5 diapositivas.\n\n¿Tienes dudas sobre tu caso? Haz el test gratuito: ${c.link}` }),
  (c) => ({ kind: "carrusel", title: "5 requisitos básicos", slides: [
    "¿Puedo acogerme? 5 requisitos básicos", "1. Ser persona física: particular o autónomo.", "2. Estar en situación de insolvencia: no poder pagar tus deudas.",
    "3. Actuar de buena fe.", "4. No haber sido condenado por ciertos delitos económicos en los últimos 10 años.", "5. No haberte acogido a la ley en los plazos que marca la norma.",
    "Cada caso es distinto. Lo revisamos contigo gratis."],
    caption: `Estos son los requisitos generales. Un abogado tiene que revisar tu caso concreto antes de decirte si encaja.\n\nTest gratuito de 1 minuto: ${c.link}` }),
  (c) => ({ kind: "reel", title: "Mito: “Voy a perder mi casa”", slides: [
    "Gancho (0-3 s): “¿Si me acojo a la Segunda Oportunidad pierdo mi casa?”", "Respuesta: no siempre. La ley permite en algunos casos conservar la vivienda habitual.",
    "Depende de tu hipoteca, del valor de la casa y de tu plan de pagos.", `Cierre: “Escríbenos y lo miramos. ${c.firm}, ${c.place}.”`],
    caption: `Es la duda número uno que nos llega. La respuesta corta: depende, y hay opciones.\n\n¿Quieres saber la tuya? ${c.link}` }),
  (c) => ({ kind: "carrusel", title: "Las llamadas de los acreedores", slides: [
    "¿Te llaman los bancos todos los días?", "No estás solo: es la situación más común de quien llega a nuestro despacho.",
    "Iniciado el procedimiento, se suspenden las ejecuciones y los embargos en la mayoría de casos.", "Y los acreedores dejan de tratar contigo: tratan con el juzgado.",
    `Da el primer paso. ${c.firm}`],
    caption: `Las llamadas constantes agotan. Hay una salida legal.\n\nCuéntanos tu caso: ${c.link}` }),
  (c) => ({ kind: "historia", title: "Encuesta: ¿Cuántos acreedores tienes?", slides: [
    "Encuesta: ¿Cuántos acreedores tienes? (1 · 2 · 3 o más)", "Si tienes 2 o más y no puedes pagar, la Ley de Segunda Oportunidad puede ser para ti.",
    `Enlace al test: ${c.link}`],
    caption: "Historia con encuesta + historia con enlace al test." }),
  (c) => ({ kind: "carrusel", title: "Qué deudas se pueden cancelar", slides: [
    "¿Qué deudas se pueden cancelar?", "Tarjetas de crédito y revolving.", "Préstamos personales y microcréditos.", "Deudas con proveedores (autónomos).",
    "Hacienda y Seguridad Social, con límites que fija la ley.", "Pensiones de alimentos y multas penales no se cancelan.", `Revisamos tus deudas gratis. ${c.firm}`],
    caption: `No todas las deudas se tratan igual. Te contamos cuáles entran.\n\nTest gratuito: ${c.link}` }),
  (c) => ({ kind: "reel", title: "Cómo es la primera consulta", slides: [
    "Gancho: “Así es tu primera consulta con nosotros”", "1. Nos cuentas tu situación: deudas, ingresos, familia.", "2. Revisamos si cumples los requisitos.",
    "3. Te explicamos los pasos, plazos y costes sin compromiso.", `Cierre: “Gratis y confidencial. ${c.firm}.”`],
    caption: `Sin compromiso y confidencial. Tráete un resumen de lo que debes.\n\nPide tu consulta: ${c.link}` }),
  (c) => ({ kind: "carrusel", title: "Autónomos: también podéis", slides: [
    "Autónomo con deudas: también puedes acogerte", "La ley vale para autónomos con deudas del negocio y personales.",
    "Hay opciones para cerrar o para seguir con la actividad.", "Hacienda y Seguridad Social tienen reglas propias: hay que estudiarlas.", `Te lo explicamos. ${c.firm}, ${c.place}`],
    caption: `Muchos autónomos no saben que la ley también es para ellos.\n\n¿Es tu caso? ${c.link}` }),
  () => ({ kind: "historia", title: "Pregunta abierta", slides: ["Caja de preguntas: “¿Qué duda tienes sobre tus deudas?”", "Respondemos las más repetidas esta semana."],
    caption: "Historia con caja de preguntas. Las respuestas dan ideas para los próximos reels." }),
  (c) => ({ kind: "carrusel", title: "Errores que empeoran las deudas", slides: [
    "3 errores que empeoran tus deudas", "1. Pedir un préstamo para pagar otro.", "2. Firmar una reunificación sin leer la letra pequeña.",
    "3. Esperar a que llegue el embargo para pedir ayuda.", `Cuanto antes lo mires, más opciones. ${c.firm}`],
    caption: `Si te reconoces en alguno, no te preocupes: tiene solución. Hablemos.\n\n${c.link}` }),
  (c) => ({ kind: "reel", title: "Cuánto tarda el procedimiento", slides: [
    "Gancho: “¿Cuánto tarda la Segunda Oportunidad?”", "Depende del juzgado y de si tienes bienes.", "Sin bienes suele ser más rápido; con vivienda puede incluir un plan de pagos.",
    `Cierre: “Te damos una estimación para tu caso. ${c.firm}.”`],
    caption: `Los plazos varían según el juzgado. En la consulta te damos una estimación realista.\n\n${c.link}` }),
  (c) => ({ kind: "carrusel", title: "Qué documentos preparar", slides: [
    "¿Qué necesito para empezar?", "DNI.", "Lista de deudas: con quién y cuánto.", "Nóminas o ingresos de los últimos meses.", "Declaración de la renta.",
    `Con esto ya podemos estudiarlo. ${c.firm}`],
    caption: `Guárdalo para tenerlo a mano.\n\n¿Empezamos? ${c.link}` }),
  (c) => ({ kind: "historia", title: "Testimonio (con permiso)", slides: ["Frase de un cliente, con su permiso y sin datos personales.", `“Volví a dormir tranquilo.” · ${c.firm}`],
    caption: "Solo con autorización escrita del cliente y sin datos que lo identifiquen." }),
  (c) => ({ kind: "carrusel", title: "Segunda Oportunidad vs. reunificación", slides: [
    "Segunda Oportunidad o reunificar deudas", "Reunificar: juntas las deudas en un préstamo nuevo. Sigues debiendo lo mismo o más.",
    "Segunda Oportunidad: el juez puede cancelar lo que no puedes pagar.", "No es para todo el mundo: depende de tu situación.", `Te ayudamos a elegir. ${c.firm}`],
    caption: `Dos caminos muy distintos. Antes de firmar nada, infórmate.\n\n${c.link}` }),
  (c) => ({ kind: "reel", title: "¿Me quedo en una lista de morosos para siempre?", slides: [
    "Gancho: “¿Saldré de los ficheros de morosos?”", "Cuando las deudas quedan canceladas, deben dar de baja tus datos de esos ficheros.",
    `Cierre: “Empezar de cero también es eso. ${c.firm}.”`],
    caption: `Otra de las preguntas que más nos hacen.\n\nTest gratuito: ${c.link}` }),
  (c) => ({ kind: "carrusel", title: `Abogados de Segunda Oportunidad en ${c.place}`, slides: [
    `Somos ${c.firm}`, `Despacho en ${c.place} especializado en Ley de Segunda Oportunidad.`, "Primera consulta gratuita y confidencial.", "Te explicamos plazos y costes desde el principio.",
    "Escríbenos por mensaje directo o haz el test."],
    caption: `Presentación del despacho. Fija esta publicación en el perfil.\n\n${c.link}` }),
];

const HASHTAGS = "#leysegundaoportunidad #segundaoportunidad #cancelardeudas #deudas #abogados";

/** Las 12 ideas del mes para un despacho. month = YYYY-MM. */
export function postsForMonth(month: string, c: Ctx): PostIdea[] {
  const [y, m] = month.split("-").map(Number);
  const offset = ((y * 12 + m) * 5) % BANK.length;
  const place = c.place.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();
  return Array.from({ length: 12 }, (_, i) => {
    const p = BANK[(offset + i) % BANK.length](c);
    return { ...p, caption: p.kind === "historia" ? p.caption : `${p.caption}\n\n${HASHTAGS}${place ? ` #abogados${place}` : ""}` };
  });
}

export const KIND_LABEL: Record<PostKind, string> = { carrusel: "Carrusel", reel: "Guion de reel", historia: "Historia" };
