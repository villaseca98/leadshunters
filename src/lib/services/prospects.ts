import "server-only";
import { query, queryOne } from "../db";
import { normalizeEmail, normalizePhone, normalizeUrl, provinceFromPostalCode, matchProvince } from "../normalize";
import { scoreProspect, type ProspectSignals } from "../scoring";

export type ProspectInput = {
  place_id?: string | null;
  name: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  google_maps_url?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  source?: string;
  search_term?: string | null;
  raw?: unknown;
};

const first = (v: unknown): string | null => {
  if (Array.isArray(v)) return (v.find((x) => typeof x === "string" && x) as string) ?? null;
  return typeof v === "string" && v ? v : null;
};

/** Acepta un item del actor de Apify "Google Maps Scraper" (compass/crawler-google-places) o nuestro formato. */
export function fromApifyItem(it: Record<string, unknown>, searchTerm?: string | null): ProspectInput | null {
  const name = first(it.title) ?? first(it.name);
  if (!name || it.permanentlyClosed === true || it.temporarilyClosed === true) return null;
  const rawWeb = first(it.website);
  const webIsInstagram = !!rawWeb && /instagram\.com/i.test(rawWeb);
  const postal = first(it.postalCode) ?? first(it.postal_code);
  const state = first(it.state) ?? first(it.province);
  return {
    place_id: first(it.placeId) ?? first(it.place_id),
    name,
    category: first(it.categoryName) ?? first(it.category) ?? first(it.categories),
    address: first(it.address),
    city: first(it.city),
    province: matchProvince(state) ?? provinceFromPostalCode(postal) ?? state,
    postal_code: postal,
    phone: normalizePhone(first(it.phoneUnformatted) ?? first(it.phone)),
    email: normalizeEmail(first(it.emails) ?? first(it.email)),
    website: webIsInstagram ? null : normalizeUrl(rawWeb),
    google_maps_url: first(it.url) ?? first(it.google_maps_url),
    rating: typeof it.totalScore === "number" ? it.totalScore : typeof it.rating === "number" ? it.rating : null,
    reviews_count: typeof it.reviewsCount === "number" ? it.reviewsCount : typeof it.reviews_count === "number" ? it.reviews_count : null,
    instagram: first(it.instagrams) ?? first(it.instagram) ?? (webIsInstagram ? rawWeb : null),
    facebook: first(it.facebooks) ?? first(it.facebook),
    linkedin: first(it.linkedIns) ?? first(it.linkedin),
    tiktok: first(it.tiktoks) ?? first(it.tiktok),
    youtube: first(it.youtubes) ?? first(it.youtube),
    source: "google_maps",
    search_term: searchTerm ?? first(it.searchString) ?? null,
    raw: it,
  };
}

const SIGNAL_COLS = `name, category, website, phone, email, rating, reviews_count, instagram, facebook, linkedin, tiktok,
  instagram_followers, instagram_days_since_post,
  website_mentions_lso, website_has_form, website_has_whatsapp, website_has_pixel, meta_ads_active, meta_ads_count, meta_ads_lso`;

export async function rescore(id: string) {
  const p = await queryOne<ProspectSignals>(`SELECT ${SIGNAL_COLS} FROM prospects WHERE id = $1`, [id]);
  if (!p) return null;
  const s = scoreProspect(p);
  await query(
    "UPDATE prospects SET score = $2, score_tier = $3, score_breakdown = $4, call_hooks = $5, updated_at = now() WHERE id = $1",
    [id, s.score, s.tier, JSON.stringify(s.breakdown), JSON.stringify(s.hooks)],
  );
  return s;
}

/** Inserta o actualiza (por place_id o nombre+teléfono). No pisa estado, notas ni datos ya enriquecidos. */
export async function upsertProspect(p: ProspectInput): Promise<{ id: string; created: boolean }> {
  const existing = p.place_id
    ? await queryOne<{ id: string }>("SELECT id FROM prospects WHERE place_id = $1", [p.place_id])
    : await queryOne<{ id: string }>(
        "SELECT id FROM prospects WHERE lower(name) = lower($1) AND coalesce(phone,'') = coalesce($2,'')",
        [p.name, p.phone ?? null],
      );
  const vals = [
    p.place_id ?? null, p.name, p.category ?? null, p.address ?? null, p.city ?? null, p.province ?? null,
    p.postal_code ?? null, p.phone ?? null, p.email ?? null, p.website ?? null, p.google_maps_url ?? null,
    p.rating ?? null, p.reviews_count ?? null, p.instagram ?? null, p.facebook ?? null, p.linkedin ?? null,
    p.tiktok ?? null, p.youtube ?? null, p.source ?? "manual", p.search_term ?? null, p.raw ? JSON.stringify(p.raw) : null,
  ];
  let id: string;
  let created = false;
  if (existing) {
    id = existing.id;
    await query(
      `UPDATE prospects SET
        place_id = coalesce($1, place_id), name = $2, category = coalesce($3, category), address = coalesce($4, address),
        city = coalesce($5, city), province = coalesce($6, province), postal_code = coalesce($7, postal_code),
        phone = coalesce($8, phone), email = coalesce($9, email), website = coalesce($10, website),
        google_maps_url = coalesce($11, google_maps_url), rating = coalesce($12, rating), reviews_count = coalesce($13, reviews_count),
        instagram = coalesce($14, instagram), facebook = coalesce($15, facebook), linkedin = coalesce($16, linkedin),
        tiktok = coalesce($17, tiktok), youtube = coalesce($18, youtube), search_term = coalesce($20, search_term),
        raw = coalesce($21, raw), updated_at = now()
       WHERE id = $22`,
      [...vals, id],
    );
  } else {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO prospects(place_id, name, category, address, city, province, postal_code, phone, email, website, google_maps_url,
        rating, reviews_count, instagram, facebook, linkedin, tiktok, youtube, source, search_term, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
      vals,
    );
    id = row!.id;
    created = true;
  }
  await rescore(id);
  return { id, created };
}

export type Enrichment = Partial<{
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  tiktok: string | null;
  youtube: string | null;
  website_mentions_lso: boolean | null;
  website_has_form: boolean | null;
  website_has_whatsapp: boolean | null;
  website_has_pixel: boolean | null;
  meta_ads_active: boolean | null;
  meta_ads_count: number | null;
  meta_ads_lso: boolean | null;
  instagram_followers: number | null;
  instagram_days_since_post: number | null;
}>;

export async function applyEnrichment(id: string, e: Enrichment) {
  const cols = [
    "email", "instagram", "facebook", "linkedin", "tiktok", "youtube", "website_mentions_lso", "website_has_form",
    "website_has_whatsapp", "website_has_pixel", "meta_ads_active", "meta_ads_count", "meta_ads_lso",
    "instagram_followers", "instagram_days_since_post",
  ] as const;
  const sets: string[] = [];
  const vals: unknown[] = [id];
  for (const c of cols) {
    const v = e[c];
    if (v === undefined || v === null || v === "") continue;
    vals.push(c === "email" ? normalizeEmail(v as string) : v);
    // las redes/email solo se rellenan si estaban vacías; las señales se actualizan siempre
    sets.push(["email", "instagram", "facebook", "linkedin", "tiktok", "youtube"].includes(c)
      ? `${c} = coalesce(${c}, $${vals.length})`
      : `${c} = $${vals.length}`);
  }
  if (e.meta_ads_active !== undefined) sets.push("meta_ads_checked_at = now()");
  sets.push("enriched_at = now()", "updated_at = now()");
  await query(`UPDATE prospects SET ${sets.join(", ")} WHERE id = $1`, vals);
  return rescore(id);
}

/** Analiza el HTML de una web para sacar señales (lo usa el flujo n8n y el botón "Analizar web"). */
export function analyzeHtml(html: string): Enrichment {
  const h = html.slice(0, 2_000_000);
  const lower = h.toLowerCase();
  const find = (re: RegExp) => {
    const m = h.match(re);
    return m ? m[0].replace(/["'<>].*$/, "") : null;
  };
  const emailMatch = Array.from(h.matchAll(/mailto:([^"'?\s>]+)/gi)).map((m) => m[1])[0]
    ?? (h.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.(es|com|net|org|eu|legal|abogado|cat)\b/i)?.[0] ?? null);
  return {
    email: emailMatch && !/\.(png|jpg|webp|svg)$/i.test(emailMatch) && !/sentry|wixpress|example/.test(emailMatch) ? emailMatch : null,
    instagram: find(/https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+/i),
    facebook: find(/https?:\/\/(www\.|es-es\.)?facebook\.com\/(?!sharer|tr\?|plugins|dialog)[A-Za-z0-9_.\-/]+/i),
    linkedin: find(/https?:\/\/([a-z]+\.)?linkedin\.com\/(company|in)\/[A-Za-z0-9_\-%]+/i),
    tiktok: find(/https?:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/i),
    youtube: find(/https?:\/\/(www\.)?youtube\.com\/(channel|c|@|user)[A-Za-z0-9_\-/@]*/i),
    website_mentions_lso: /segunda oportunidad|cancelar (tus |las )?deudas|cancelaci[oó]n de deudas|exoneraci[oó]n del pasivo|concurso de acreedores|insolvencia/.test(lower),
    website_has_form: /<form[\s>]/.test(lower) || /contact-form-7|wpforms|gform_|hs-form|typeform|calendly/.test(lower),
    website_has_whatsapp: /wa\.me\/|api\.whatsapp\.com|whatsapp/.test(lower),
    website_has_pixel: /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(|googleadservices|gtag\(['"]config['"],\s*['"]aw-/.test(lower),
  };
}
