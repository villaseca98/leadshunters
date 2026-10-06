// Auditoría de captación que se le enseña al propio despacho (enlace público).
// Solo usa datos comprobados: lo que no sabemos no se marca ni bien ni mal.

export type AuditInput = {
  name: string;
  city: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  instagram: string | null;
  instagram_days_since_post: number | null;
  website_has_form: boolean | null;
  website_has_whatsapp: boolean | null;
  website_has_pixel: boolean | null;
  meta_ads_active: boolean | null;
  call_hooks: string[];
};

export type CityStats = { total: number; con_anuncios: number; reviews_rank: number | null };

export type AuditCheck = { label: string; ok: boolean | null; detail: string };

export function buildAudit(p: AuditInput, city: CityStats) {
  const checks: AuditCheck[] = [
    {
      label: "Web propia",
      ok: !!p.website,
      detail: p.website ? "Quien te busca en Google tiene dónde informarse" : "Quien te busca en Google no tiene dónde dejar sus datos",
    },
    {
      label: "Formulario de contacto",
      ok: p.website ? p.website_has_form : false,
      detail: p.website_has_form ? "Puedes recibir consultas a cualquier hora" : "Las visitas de noche y en fin de semana se pierden",
    },
    {
      label: "WhatsApp en la web",
      ok: p.website ? p.website_has_whatsapp : false,
      detail: p.website_has_whatsapp ? "El canal que más usa quien tiene deudas" : "Es el canal que más usa quien tiene deudas y le da vergüenza llamar",
    },
    {
      label: "Medición de anuncios",
      ok: p.website ? p.website_has_pixel : false,
      detail: p.website_has_pixel ? "Puedes medir y volver a impactar a quien visitó tu web" : "No puedes volver a impactar a quien visitó tu web y se fue",
    },
    {
      label: "Anuncios en Meta",
      ok: p.meta_ads_active,
      detail:
        p.meta_ads_active == null
          ? "Sin comprobar"
          : p.meta_ads_active
            ? "Ya captas en Facebook e Instagram"
            : "No apareces donde se informan la mayoría de personas con deudas",
    },
    {
      label: "Instagram activo",
      ok: !p.instagram ? false : p.instagram_days_since_post == null ? null : p.instagram_days_since_post <= 30,
      detail: !p.instagram
        ? "No hemos encontrado tu Instagram"
        : p.instagram_days_since_post == null
          ? "Sin comprobar"
          : `Última publicación hace ${p.instagram_days_since_post} días`,
    },
  ];
  const known = checks.filter((c) => c.ok !== null);
  const passed = known.filter((c) => c.ok).length;

  const reviews =
    p.reviews_count == null
      ? null
      : city.reviews_rank && city.total > 1 && p.city
        ? `${p.reviews_count} reseñas en Google (${p.rating ?? "—"}★): puesto ${city.reviews_rank} de ${city.total} despachos de Segunda Oportunidad en ${p.city}`
        : `${p.reviews_count} reseñas en Google (${p.rating ?? "—"}★)`;

  const market =
    p.city && city.total > 1
      ? `En ${p.city} hemos analizado ${city.total} despachos que ofrecen Segunda Oportunidad` +
        (city.con_anuncios ? `; ${city.con_anuncios} ya anuncian en Meta para captar a esas personas.` : ".")
      : null;

  return { checks, passed, total: known.length, reviews, market };
}

/** Mensaje para enviar el enlace de la auditoría (WhatsApp o email) después de hablar con el despacho. */
export function auditMessage(p: { name: string; call_hooks: string[] }, link: string, from: string) {
  const hook = p.call_hooks[0];
  const subject = `Diagnóstico de captación de ${p.name}`;
  const body = [
    `Hola, soy ${from}, de Leads Hunters. Como os comentaba, os paso el diagnóstico de captación online de ${p.name}:`,
    link,
    hook ? `Lo más importante que hemos visto: ${hook.charAt(0).toLowerCase()}${hook.slice(1)}.` : null,
    "Trabajamos solo con despachos de Segunda Oportunidad: llamamos a cada interesado en menos de 5 minutos y os pasamos únicamente consultas cualificadas. Pagáis una cuota fija y cada consulta que se realiza, nunca un porcentaje de vuestros honorarios.",
    "¿Os viene bien 15 minutos esta semana para verlo?",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, body };
}
