// Lecturas automáticas del informe interno: qué va bien, qué falla y dónde poner el foco. Solo para uso propio.
import type { Breakdown, LineReport, Report } from "./services/reports";

/** area: "despachos", "general" o el nombre con emoji de la línea */
export type Insight = { tone: "bad" | "good" | "info"; area: string; text: string };

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const mins = (m: number) => (m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
const eur = (n: number) => `${Math.round(n).toLocaleString("es-ES")} €`;

function trend(area: Insight["area"], label: string, now: number, prev: number, out: Insight[]) {
  if (prev >= 5 && now < prev * 0.7) out.push({ tone: "bad", area, text: `${label}: ${now} leads este mes frente a ${prev} el anterior (−${100 - pct(now, prev)} %). Revisa si se ha parado algún anuncio o reel.` });
  else if (prev >= 5 && now > prev * 1.3) out.push({ tone: "good", area, text: `${label}: ${now} leads, un ${pct(now, prev) - 100} % más que el mes pasado.` });
}

function campaigns(area: Insight["area"], rows: Breakdown[], wonLabel: string, out: Insight[]) {
  const dead = rows.filter((c) => c.key !== "—" && c.leads >= 10 && c.won === 0);
  for (const c of dead.slice(0, 2)) out.push({ tone: "bad", area, text: `«${c.key}» trajo ${c.leads} leads y ningún ${wonLabel}. Cambia el anuncio o la pregunta de filtro, o páusala.` });
  const best = rows.filter((c) => c.key !== "—" && c.leads >= 5 && c.won > 0).sort((a, b) => b.won / b.leads - a.won / a.leads)[0];
  if (best) out.push({ tone: "good", area, text: `Lo que mejor convierte: «${best.key}» (${pct(best.won, best.leads)} % de ${best.leads} leads acaban en ${wonLabel}). Dale más presupuesto o haz más reels así.` });
}

function lineInsights(r: LineReport, out: Insight[]) {
  const area = `${r.line.emoji} ${r.line.name}`;
  const name = r.line.name;
  const won = r.line.won_label.toLowerCase();
  if (r.sin_llamar_24h > 0) out.push({ tone: "bad", area, text: `${r.sin_llamar_24h} ${r.sin_llamar_24h === 1 ? "lead lleva" : "leads llevan"} más de 24 h sin llamar. Pasado un día casi nadie contesta: llámalos hoy.` });
  if (r.leads === 0) {
    out.push({ tone: "info", area, text: `${name}: sin leads este mes. Publica reels con la palabra clave ${r.line.slug.toUpperCase()} y conecta su automatización de ManyChat.` });
    return;
  }
  trend(area, name, r.leads, r.prev_leads, out);
  if (r.speed_min != null && r.speed_min > 60) out.push({ tone: "bad", area, text: `${name}: tardas ${mins(r.speed_min)} de media en el primer contacto. Por debajo de 1 h se cierra bastante más.` });
  if (r.leads >= 5 && pct(r.contactados, r.leads) < 60) out.push({ tone: "bad", area, text: `${name}: solo hablas con el ${pct(r.contactados, r.leads)} % de los leads. Escribe por WhatsApp antes de llamar y prueba a otra hora.` });
  const c = r.priority.find((p) => p.key === "C");
  if (c && r.leads >= 5 && c.leads / r.leads > 0.4) out.push({ tone: "info", area, text: `${name}: el ${pct(c.leads, r.leads)} % de los leads son prioridad C. Añade en ManyChat una pregunta que los filtre antes de pedir el teléfono, o cambia el público del anuncio.` });
  const a = r.priority.find((p) => p.key === "A");
  if (a && a.leads >= 3 && c && c.leads >= 3 && a.won / a.leads > (c.won / c.leads) * 2) out.push({ tone: "good", area, text: `${name}: los de prioridad A cierran el ${pct(a.won, a.leads)} % frente al ${pct(c.won, c.leads)} % de los C. Llama siempre primero a los A.` });
  campaigns(area, r.campaigns, won, out);
  const lost = r.lost[0];
  if (lost && lost.n >= 3) out.push({ tone: "info", area, text: `${name}: el motivo de descarte más repetido es «${lost.key}» (${lost.n}). Respóndelo en el guion o en un reel.` });
  if (r.contratados > 0) out.push({ tone: "good", area, text: `${name}: ${r.contratados} ${won} y ${eur(r.comision)} de ${r.line.value_label.toLowerCase()}${r.prev_comision > 0 ? ` (el mes pasado ${eur(r.prev_comision)})` : ""}.` });
}

export function reportInsights(r: Report): Insight[] {
  const out: Insight[] = [];
  const d = r.despachos;
  trend("despachos", "Despachos", d.leads, d.prev_leads, out);
  if (d.speed_min != null && d.speed_min > 5) out.push({ tone: "bad", area: "despachos", text: `Tardas ${mins(d.speed_min)} de media en llamar a un lead de deudas; el objetivo son 5 min (y pasado ese tiempo la consulta sale gratis al despacho).` });
  if (d.leads >= 5 && pct(d.contactados, d.leads) < 60) out.push({ tone: "bad", area: "despachos", text: `Solo contactas con el ${pct(d.contactados, d.leads)} % de los leads de deudas. Haz el segundo intento el mismo día y escribe por WhatsApp.` });
  const held = d.asistidas + d.no_asistio;
  if (held >= 4 && d.no_asistio / held > 0.25) out.push({ tone: "bad", area: "despachos", text: `El ${pct(d.no_asistio, held)} % de las consultas no se presentan. Confirma la víspera por WhatsApp y agenda en menos de 48 h.` });
  campaigns("despachos", d.campaigns, "consulta", out);
  if (d.sin_despacho > 0) out.push({ tone: "info", area: "despachos", text: `${d.sin_despacho} ${d.sin_despacho === 1 ? "persona apta hizo" : "personas aptas hicieron"} el test sin despacho en su provincia. Úsalo al llamar a despachos de esas provincias.` });
  if (d.clientes_activos < 3 && d.llamadas_b2b < 100) out.push({ tone: "info", area: "despachos", text: `${d.llamadas_b2b} llamadas a despachos este mes y ${d.clientes_activos} ${d.clientes_activos === 1 ? "cliente activo" : "clientes activos"}. Para llenar plazas hacen falta unas 20 llamadas al día.` });

  for (const l of r.lines) lineInsights(l, out);

  // Dónde rinde más cada lead: para decidir dónde poner tiempo y presupuesto
  const perLead = [
    { k: "despachos", v: d.leads ? d.facturacion / d.leads : 0, n: d.leads },
    ...r.lines.map((l) => ({ k: l.line.name.toLowerCase(), v: l.leads ? l.comision / l.leads : 0, n: l.leads })),
  ].filter((x) => x.n >= 5 && x.v > 0).sort((a, b) => b.v - a.v);
  if (perLead.length >= 2) out.push({ tone: "info", area: "general", text: `Ingreso por lead: ${perLead.map((x) => `${x.k} ${eur(x.v)}`).join(" · ")}. Pon más tiempo y anuncios en ${perLead[0].k}.` });
  return out;
}

/** Resumen corto para mandarte por WhatsApp o que lo envíe n8n. */
export function reportText(r: Report, monthName: string, insights = reportInsights(r)): string {
  const d = r.despachos;
  const e = (x: LineReport) => `${x.leads} leads · ${x.contactados} contactados · ${x.contratados} ${x.line.won_label.toLowerCase()} · ${eur(x.comision)}`;
  const lines = [
    `📊 Informe interno · ${monthName}`,
    `⚖️ Despachos: ${d.leads} leads · ${d.citas} consultas (${d.asistidas} hechas) · ${d.clientes_activos} ${d.clientes_activos === 1 ? "cliente" : "clientes"} · ${eur(d.facturacion)}`,
    ...r.lines.map((l) => `${l.line.emoji} ${l.line.name} (${l.line.company_name}): ${e(l)}`),
  ];
  const top = insights.filter((i) => i.tone !== "good").slice(0, 4);
  if (top.length) lines.push("", "Para mejorar:", ...top.map((i) => `• ${i.text}`));
  return lines.join("\n");
}
