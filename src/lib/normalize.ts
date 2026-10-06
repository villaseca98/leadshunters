// Utilidades para limpiar datos que llegan de Apify, Meta, Google Ads y formularios.

const PROVINCES_BY_CP: Record<string, string> = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila", "06": "Badajoz",
  "07": "Baleares", "08": "Barcelona", "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón",
  "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca", "17": "Girona", "18": "Granada",
  "19": "Guadalajara", "20": "Gipuzkoa", "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León",
  "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
  "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia", "41": "Sevilla",
  "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid",
  "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};

export const PROVINCES = Array.from(new Set(Object.values(PROVINCES_BY_CP))).sort((a, b) => a.localeCompare(b, "es"));

export function provinceFromPostalCode(cp?: string | null): string | null {
  if (!cp) return null;
  const m = String(cp).match(/\b(\d{5})\b/);
  return m ? PROVINCES_BY_CP[m[1].slice(0, 2)] ?? null : null;
}

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca una provincia por nombre aproximado ("malaga" -> "Málaga"). */
export function matchProvince(input?: string | null): string | null {
  if (!input) return null;
  const s = strip(input);
  const aliases: Record<string, string> = {
    "la coruna": "A Coruña", coruna: "A Coruña", "a coruna": "A Coruña", vizcaya: "Bizkaia", guipuzcoa: "Gipuzkoa",
    alava: "Álava", araba: "Álava", "islas baleares": "Baleares", "illes balears": "Baleares", mallorca: "Baleares",
    tenerife: "Santa Cruz de Tenerife", "gran canaria": "Las Palmas", gerona: "Girona", lerida: "Lleida", orense: "Ourense",
    "castello": "Castellón", "valencia/valencia": "Valencia", "alacant": "Alicante",
  };
  if (aliases[s]) return aliases[s];
  return PROVINCES.find((p) => strip(p) === s) ?? PROVINCES.find((p) => s.includes(strip(p))) ?? null;
}

/** Normaliza teléfonos españoles a +34XXXXXXXXX. Deja otros formatos internacionales tal cual (limpios). */
export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (/^[6789]\d{8}$/.test(s)) return "+34" + s;
  if (/^34[6789]\d{8}$/.test(s)) return "+" + s;
  if (s.startsWith("+")) return s;
  return s.length >= 9 ? s : null;
}

export function normalizeEmail(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export function normalizeUrl(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    return new URL(s).toString();
  } catch {
    return null;
  }
}

/** "Entre 10.000 y 30.000 €" -> 20000 · "Más de 50k" -> 50000 · "Menos de 6.000€" -> 5999 */
export function parseMoney(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const s = strip(String(input));
  const nums = Array.from(s.matchAll(/(\d+(?:[.,\s]\d{3})*(?:[.,]\d+)?)\s*(k|mil)?/g))
    .map((m) => {
      let raw = m[1].replace(/\s/g, "");
      // 10.000 / 10,000 -> miles; 10,5 -> decimal
      if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) raw = raw.replace(/[.,]/g, "");
      else if (/[.,]\d{1,2}$/.test(raw)) {
        // el último separador es el decimal ("1.200,50" o "1,200.50")
        const dec = raw.length - raw.search(/[.,]\d{1,2}$/);
        raw = raw.slice(0, -dec).replace(/[.,]/g, "") + "." + raw.slice(-dec + 1);
      } else raw = raw.replace(/[.,]/g, "");
      let n = parseFloat(raw);
      if (m[2]) n *= 1000;
      return n;
    })
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  if (/menos|hasta|inferior|<|max/.test(s)) return Math.max(0, Math.max(...nums) - 1);
  if (nums.length >= 2 && /entre|-|a /.test(s)) return Math.round((nums[0] + nums[1]) / 2);
  return nums[0];
}

/** "3 o más" -> 3 · "Entre 2 y 4" -> 3 · "uno" -> 1 */
export function parseCount(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Math.round(input);
  const s = strip(String(input));
  const words: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  const nums = Array.from(s.matchAll(/\d+/g)).map((m) => parseInt(m[0], 10));
  if (nums.length >= 2 && /entre|-/.test(s)) return Math.round((nums[0] + nums[1]) / 2);
  if (nums.length) return nums[0];
  for (const [w, n] of Object.entries(words)) if (new RegExp(`\\b${w}\\b`).test(s)) return n;
  return null;
}

export function parseBool(input: unknown): boolean | null {
  if (typeof input === "boolean") return input;
  if (input === null || input === undefined || input === "") return null;
  const s = strip(String(input));
  if (/^(si|s|yes|true|1|tengo|claro)/.test(s)) return true;
  if (/^(no|n|false|0|ninguna|nunca)/.test(s)) return false;
  return null;
}

export function parseEmployment(input: unknown): string | null {
  if (!input) return null;
  const s = strip(String(input));
  if (/autonom|freelance|cuenta propia/.test(s)) return "autonomo";
  if (/desemple|paro|sin trabajo|no trabajo/.test(s)) return "desempleado";
  if (/pension|jubil/.test(s)) return "pensionista";
  if (/asalari|cuenta ajena|nomina|empleado|trabajo|funcionari/.test(s)) return "asalariado";
  return "otro";
}

export type LeadFields = {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  province?: string | null;
  debt_amount?: number | null;
  creditors_count?: number | null;
  monthly_income?: number | null;
  employment_status?: string | null;
  owns_home?: boolean | null;
  prior_lso?: boolean | null;
  criminal_record?: boolean | null;
};

/**
 * Mapea respuestas libres de un formulario (Meta, Google, web) a nuestros campos,
 * buscando palabras clave en el nombre de la pregunta. Así no hace falta que los
 * formularios usen nombres exactos.
 */
export function mapAnswers(answers: Record<string, unknown>): LeadFields {
  const out: LeadFields = {};
  let first = "";
  let last = "";
  for (const [k, v] of Object.entries(answers)) {
    if (v === null || v === undefined || v === "") continue;
    const key = strip(k).replace(/[_\-?¿]/g, " ");
    const val = Array.isArray(v) ? v.join(", ") : String(v);
    if (/^(full name|nombre completo|nombre y apellidos|name)$/.test(key) || key === "full name") out.full_name = val;
    else if (/^(first name|nombre)$/.test(key)) first = val;
    else if (/^(last name|apellidos?)$/.test(key)) last = val;
    else if (/phone|telefono|movil|whatsapp/.test(key)) out.phone = normalizePhone(val);
    else if (/mail|correo/.test(key)) out.email = normalizeEmail(val);
    else if (/provincia|province|region|ciudad|city|localidad/.test(key)) out.province = matchProvince(val) ?? val;
    else if (/postal|zip|cp\b/.test(key)) out.province = out.province ?? provinceFromPostalCode(val);
    else if (/acreedor|entidad|bancos|financier|cuantas deudas|numero de deudas/.test(key)) out.creditors_count = parseCount(val);
    else if (/ingres|sueldo|salario|cobras|nomina/.test(key)) out.monthly_income = parseMoney(val);
    else if (/deud|debes|importe/.test(key)) out.debt_amount = parseMoney(val);
    else if (/situacion|laboral|trabaj|empleo|ocupacion/.test(key)) out.employment_status = parseEmployment(val);
    else if (/vivienda|casa|piso|propiedad|inmueble|hipoteca/.test(key)) out.owns_home = parseBool(val);
    else if (/segunda oportunidad|ya has|anteriormente|ultimos 5/.test(key)) out.prior_lso = parseBool(val);
    else if (/condena|antecedente|delito/.test(key)) out.criminal_record = parseBool(val);
  }
  if (!out.full_name && (first || last)) out.full_name = `${first} ${last}`.trim();
  return out;
}
