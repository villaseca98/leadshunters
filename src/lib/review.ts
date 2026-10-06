/** Mensaje para pedir una reseña en Google en nombre del despacho, tras una consulta realizada. */
export const reviewMessage = (lead: string, firm: string, url: string) =>
  `Hola ${lead.trim().split(/\s+/)[0]}, gracias por confiar en ${firm}. Si la consulta te resultó útil, nos ayudaría mucho que dejaras tu opinión en Google, es un minuto: ${url}\n¡Gracias!`;
