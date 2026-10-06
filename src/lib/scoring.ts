// Puntuación de despachos prospecto (0-100) para decidir a quién llamar primero.
// Cada criterio deja una línea en el desglose para que el telefonista sepa por qué.

export type ProspectSignals = {
  name: string;
  category?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  instagram_followers?: number | null;
  instagram_days_since_post?: number | null;
  website_mentions_lso?: boolean | null;
  website_has_form?: boolean | null;
  website_has_whatsapp?: boolean | null;
  website_has_pixel?: boolean | null;
  meta_ads_active?: boolean | null;
  meta_ads_count?: number | null;
  meta_ads_lso?: boolean | null;
};

export type ScoreLine = { criterio: string; puntos: number; max: number; detalle: string };

const LSO_RE = /segunda oportunidad|cancela(r|cion) (de )?(tus |las )?deudas|insolvencia|concurs|exoneraci|ley de la segunda|sin deudas|deudas/i;
const LAW_RE = /abogad|bufete|despacho|jur[ií]dic|legal|advocat|law/i;

export function scoreProspect(p: ProspectSignals): {
  score: number;
  tier: "A" | "B" | "C";
  breakdown: ScoreLine[];
  hooks: string[];
} {
  const lines: ScoreLine[] = [];
  const hooks: string[] = [];
  const text = `${p.name} ${p.category ?? ""}`;

  // 1. Encaje con el nicho (30)
  if (LSO_RE.test(text) || p.website_mentions_lso) {
    lines.push({ criterio: "Encaje nicho", puntos: 30, max: 30, detalle: "Trabaja Segunda Oportunidad / deudas" });
  } else if (LAW_RE.test(text)) {
    lines.push({
      criterio: "Encaje nicho",
      puntos: p.website_mentions_lso === false ? 8 : 14,
      max: 30,
      detalle: p.website_mentions_lso === false ? "Despacho, su web no menciona LSO" : "Despacho de abogados (sin confirmar LSO)",
    });
  } else {
    lines.push({ criterio: "Encaje nicho", puntos: 0, max: 30, detalle: "No parece un despacho de abogados" });
  }

  // 2. Tamaño: buscamos pequeños y medianos (20)
  const r = p.reviews_count;
  if (r === null || r === undefined) lines.push({ criterio: "Tamaño", puntos: 8, max: 20, detalle: "Sin datos de reseñas" });
  else if (r >= 5 && r <= 250) lines.push({ criterio: "Tamaño", puntos: 20, max: 20, detalle: `${r} reseñas: pequeño/mediano` });
  else if (r > 250 && r <= 600) lines.push({ criterio: "Tamaño", puntos: 10, max: 20, detalle: `${r} reseñas: mediano-grande` });
  else if (r > 600) lines.push({ criterio: "Tamaño", puntos: 2, max: 20, detalle: `${r} reseñas: gran firma, suele tener marketing propio` });
  else lines.push({ criterio: "Tamaño", puntos: 10, max: 20, detalle: `${r} reseñas: muy pequeño o nuevo` });

  // 3. Reputación (10)
  const rt = p.rating;
  const rep = rt == null ? 3 : rt >= 4.5 ? 10 : rt >= 4 ? 7 : rt >= 3.5 ? 3 : 0;
  lines.push({ criterio: "Reputación", puntos: rep, max: 10, detalle: rt == null ? "Sin valoración" : `${rt}★ en Google` });

  // 4. Ya invierte en captación (20): tiene presupuesto y entiende el modelo
  let inv = 0;
  const invDet: string[] = [];
  if (p.meta_ads_active) {
    inv += 12;
    invDet.push(`${p.meta_ads_count ?? "?"} anuncios activos en Meta`);
    if (p.meta_ads_lso) {
      inv += 4;
      invDet.push("anuncia deudas/LSO");
    }
  }
  if (p.website_has_pixel) {
    inv += 4;
    invDet.push("tiene píxel/etiqueta de anuncios");
  }
  lines.push({
    criterio: "Inversión en captación",
    puntos: Math.min(inv, 20),
    max: 20,
    detalle: invDet.length ? invDet.join(", ") : p.meta_ads_active === false ? "No anuncia en Meta" : "Sin comprobar",
  });

  // 5. Oportunidad de mejora (10): huecos que nosotros cubrimos
  let op = 0;
  const opDet: string[] = [];
  if (!p.website) {
    op += 4;
    opDet.push("sin web");
    hooks.push("No tiene web propia: los clientes que le buscan en Google no tienen dónde dejar sus datos");
  } else if (p.website_has_form === false && p.website_has_whatsapp === false) {
    op += 4;
    opDet.push("web sin formulario ni WhatsApp");
    hooks.push("Su web no tiene formulario ni WhatsApp: pierde a quien la visita de noche o en fin de semana");
  }
  const socials = [p.instagram, p.facebook, p.tiktok, p.linkedin].filter(Boolean).length;
  if (socials <= 1) {
    op += 4;
    opDet.push(socials === 0 ? "sin redes sociales" : "redes flojas");
  } else if (socials === 2) {
    op += 2;
    opDet.push("presencia social media");
  }
  if (!p.instagram) {
    hooks.push("No encuentro su Instagram desde la web ni desde Google");
  } else {
    if (p.instagram_followers != null && p.instagram_followers < 2000) {
      op += 1;
      opDet.push(`Instagram pequeño (${p.instagram_followers} seguidores)`);
    }
    if (p.instagram_days_since_post != null && p.instagram_days_since_post > 30) {
      op += 1;
      opDet.push(`${p.instagram_days_since_post} días sin publicar`);
      hooks.push(`Su Instagram lleva ${p.instagram_days_since_post} días sin publicar`);
    }
  }
  if (p.meta_ads_active === false && p.website_mentions_lso) {
    hooks.push("Ofrece Segunda Oportunidad pero no anuncia en Meta: su competencia sí capta ahí");
  }
  if (p.meta_ads_active && p.meta_ads_lso) {
    hooks.push("Ya anuncia Segunda Oportunidad: preguntar cuánto le cuesta cada consulta y quién llama a los leads");
  }
  lines.push({ criterio: "Oportunidad", puntos: Math.min(op, 10), max: 10, detalle: opDet.join(", ") || "Marketing digital ya cubierto" });

  // 6. Contactabilidad (10)
  const ct = (p.phone ? 7 : 0) + (p.email ? 3 : 0);
  lines.push({
    criterio: "Contacto",
    puntos: ct,
    max: 10,
    detalle: [p.phone ? "teléfono" : "sin teléfono", p.email ? "email" : null].filter(Boolean).join(" + "),
  });

  let score = lines.reduce((a, l) => a + l.puntos, 0);
  if (!p.phone) score = Math.min(score, 40); // sin teléfono no entra en la cola de llamadas
  const tier = score >= 70 ? "A" : score >= 45 ? "B" : "C";
  return { score, tier, breakdown: lines, hooks };
}
