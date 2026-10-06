// Genera los flujos de n8n (JSON importables) en la carpeta n8n/.
// Uso: node scripts/generar-flujos-n8n.mjs
// Los flujos leen la configuración de variables de entorno de n8n:
//   LH_API_URL, LH_API_KEY, APIFY_TOKEN, META_ADS_LIBRARY_TOKEN, TELEGRAM_CHAT_ID,
//   GOOGLE_ADS_WEBHOOK_KEY, EMAIL_FROM, APP_URL
import { writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "n8n");
mkdirSync(OUT, { recursive: true });

const API = "={{ $env.LH_API_URL }}";
const apiUrl = (p) => `={{ $env.LH_API_URL }}${p}`;
const authHeaders = { parameters: [{ name: "x-api-key", value: "={{ $env.LH_API_KEY }}" }] };

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { parameters, id: randomUUID(), name, type, typeVersion, position, ...extra };
}

function http(name, position, { method = "GET", url, body, query, headers = true, timeout, extraOptions = {}, ...extra }) {
  const p = { method, url, options: { ...(timeout ? { timeout } : {}), ...extraOptions } };
  if (headers) {
    p.sendHeaders = true;
    p.headerParameters = headers === true ? authHeaders : headers;
  }
  if (query) {
    p.sendQuery = true;
    p.queryParameters = { parameters: Object.entries(query).map(([name, value]) => ({ name, value })) };
  }
  if (body) {
    p.sendBody = true;
    p.specifyBody = "json";
    p.jsonBody = body;
  }
  return node(name, "n8n-nodes-base.httpRequest", 4.2, position, p, extra);
}

const code = (name, position, jsCode, mode) =>
  node(name, "n8n-nodes-base.code", 2, position, mode ? { mode, jsCode } : { jsCode });

const telegram = (name, position, text) =>
  node(name, "n8n-nodes-base.telegram", 1.2, position, {
    chatId: "={{ $env.TELEGRAM_CHAT_ID }}",
    text,
    additionalFields: { parse_mode: "HTML", appendAttribution: false },
  });

const email = (name, position, { to, subject, html }) =>
  node(name, "n8n-nodes-base.emailSend", 2.1, position, {
    fromEmail: "={{ $env.EMAIL_FROM }}",
    toEmail: to,
    subject,
    emailFormat: "html",
    html,
    options: { appendAttribution: false },
  });

function ifNode(name, position, leftValue, operation = "true", type = "boolean", rightValue) {
  const op = { type, operation };
  if (rightValue === undefined) op.singleValue = true;
  return node(name, "n8n-nodes-base.if", 2.2, position, {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
      conditions: [{ id: randomUUID(), leftValue, rightValue: rightValue ?? "", operator: op }],
      combinator: "and",
    },
    options: {},
  });
}

function sticky(content, position, width = 420, height = 300, color = 7) {
  return node(`Nota ${randomUUID().slice(0, 4)}`, "n8n-nodes-base.stickyNote", 1, position, { content, width, height, color });
}

/** connections: [[from, to, fromOutput=0]] */
function workflow(name, nodes, links, settings = {}) {
  const connections = {};
  for (const [from, to, out = 0] of links) {
    connections[from] ??= { main: [] };
    while (connections[from].main.length <= out) connections[from].main.push([]);
    connections[from].main[out].push({ node: to, type: "main", index: 0 });
  }
  for (const [from, to] of links) {
    if (!nodes.find((n) => n.name === from)) throw new Error(`${name}: no existe el nodo ${from}`);
    if (!nodes.find((n) => n.name === to)) throw new Error(`${name}: no existe el nodo ${to}`);
  }
  return {
    name,
    nodes,
    connections,
    active: false,
    settings: { executionOrder: "v1", timezone: "Europe/Madrid", saveManualExecutions: true, ...settings },
    pinData: {},
    meta: { templateCredsSetupCompleted: false },
    tags: [],
  };
}

// Valores por defecto del nodo "Config" que se añade a cada flujo.
// Se edita una vez en n8n (funciona igual en n8n Cloud y en tu servidor).
const CONFIG_DEFAULTS = {
  LH_API_URL: "https://app.tudominio.com",
  LH_API_KEY: "PEGA_AQUI_LA_N8N_API_KEY_DE_LA_APP",
  APP_URL: "https://app.tudominio.com",
  APIFY_TOKEN: "PEGA_AQUI_TU_TOKEN_DE_APIFY",
  META_ADS_LIBRARY_TOKEN: "PEGA_AQUI_TU_TOKEN_DE_META",
  TELEGRAM_CHAT_ID: "PEGA_AQUI_TU_CHAT_ID",
  GOOGLE_ADS_WEBHOOK_KEY: "PEGA_AQUI_UNA_CLAVE_SECRETA",
  EMAIL_FROM: "Leads Hunters <hola@tudominio.com>",
  TWILIO_FROM: "+34000000000",
  N8N_EVENTS_WEBHOOK_URL: "https://TU-N8N/webhook/leads-hunters-eventos",
};
const TRIGGER_TYPES = ["Trigger", "webhook", "manualTrigger"];

/**
 * Sustituye $env.X por $('Config').first().json.X y mete un nodo "Config" (Set que conserva
 * los datos de entrada) justo después de los disparadores. n8n Cloud no permite $env.
 */
function withConfig(wf) {
  const used = new Set();
  const re = /\$env\.([A-Z0-9_]+)/g;
  for (const n of wf.nodes) for (const m of JSON.stringify(n.parameters).matchAll(re)) used.add(m[1]);
  if (!used.size) return wf;
  const ref = (k) => `$('Config').first().json.${k}`;
  for (const n of wf.nodes) n.parameters = JSON.parse(JSON.stringify(n.parameters).replace(re, (_, k) => ref(k)));
  const triggers = wf.nodes.filter((n) => TRIGGER_TYPES.some((t) => n.type.endsWith(t) || n.type.includes(t)) && n.type !== "n8n-nodes-base.stickyNote");
  const t0 = triggers[0];
  const shift = 220;
  for (const n of wf.nodes) if (!triggers.includes(n) && n.type !== "n8n-nodes-base.stickyNote") n.position = [n.position[0] + shift, n.position[1]];
  const ys = triggers.map((t) => t.position[1]);
  const config = node("Config", "n8n-nodes-base.set", 3.4, [t0.position[0] + shift, Math.round(ys.reduce((a, b) => a + b, 0) / ys.length)], {
    mode: "manual",
    includeOtherFields: true,
    assignments: {
      assignments: [...used].sort().map((k) => ({ id: randomUUID(), name: k, value: CONFIG_DEFAULTS[k] ?? "", type: "string" })),
    },
    options: {},
  });
  wf.nodes.push(config);
  let targets = null;
  for (const t of triggers) {
    const out = wf.connections[t.name]?.main?.[0] ?? [];
    targets ??= out;
    wf.connections[t.name] = { main: [[{ node: "Config", type: "main", index: 0 }]] };
  }
  wf.connections.Config = { main: [targets ?? []] };
  return wf;
}

function save(file, wf) {
  wf = withConfig(wf);
  writeFileSync(path.join(OUT, file), JSON.stringify(wf, null, 2) + "\n");
  console.log("✓", file);
}

// ---------------------------------------------------------------------------
// 01 · Prospección: Google Maps (Apify) -> app -> análisis web + Meta Ad Library + Instagram
// ---------------------------------------------------------------------------
{
  const cfg = node("Configuración", "n8n-nodes-base.set", 3.4, [440, 300], {
    assignments: {
      assignments: [
        {
          id: randomUUID(), name: "busquedas", type: "array",
          value: '["abogados segunda oportunidad", "abogado ley de segunda oportunidad", "abogados cancelar deudas", "abogado concurso de acreedores persona física"]',
        },
        {
          id: randomUUID(), name: "ciudades", type: "array",
          value: '["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga", "Alicante", "Murcia", "Zaragoza", "Bilbao", "Palma"]',
        },
        { id: randomUUID(), name: "maxPorBusqueda", type: "number", value: 30 },
        { id: randomUUID(), name: "analizarInstagram", type: "boolean", value: true },
      ],
    },
    options: {},
  });

  const prep = code("Preparar búsquedas", [660, 300], `// Combina cada búsqueda con cada ciudad: "abogados segunda oportunidad Valencia"
const c = $input.first().json;
const busquedas = [];
for (const ciudad of c.ciudades) for (const b of c.busquedas) busquedas.push(\`\${b} \${ciudad}\`);
return [{ json: {
  searchStringsArray: busquedas,
  maxCrawledPlacesPerSearch: c.maxPorBusqueda,
  language: "es",
  countryCode: "es",
  skipClosedPlaces: true,
  scrapeContacts: true,
  scrapePlaceDetailPage: false,
} }];`);

  const apify = http("Apify · Google Maps", [880, 300], {
    method: "POST",
    url: "=https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token={{ $env.APIFY_TOKEN }}&timeout=900",
    headers: false,
    body: "={{ JSON.stringify($json) }}",
    timeout: 900000,
  });

  const group = code("Agrupar resultados", [1100, 300], `// Manda todos los despachos a la app en una sola llamada (la app limpia, deduplica y puntúa)
const items = $input.all().map(i => i.json).filter(x => x && (x.title || x.name));
return [{ json: { items, search_term: $('Configuración').first().json.busquedas.join(' | ') } }];`);

  const send = http("Enviar despachos a la app", [1320, 300], {
    method: "POST", url: apiUrl("/api/v1/prospects"), body: "={{ JSON.stringify($json) }}", timeout: 300000,
  });

  const pending = http("Despachos sin analizar", [1540, 300], {
    url: apiUrl("/api/v1/prospects/pending"), query: { limit: "100" },
  });

  const split = code("Separar despachos", [1760, 300], `return $input.first().json.prospects.map(p => ({ json: p }));`);

  const web = http("Descargar web", [1980, 300], {
    url: "={{ $json.website || 'https://invalid.invalid' }}",
    headers: { parameters: [{ name: "user-agent", value: "Mozilla/5.0 (compatible; LeadsHuntersBot/1.0)" }] },
    timeout: 15000,
    extraOptions: { response: { response: { responseFormat: "text", outputPropertyName: "html" } }, redirect: { redirect: { maxRedirects: 5 } } },
    onError: "continueRegularOutput",
    alwaysOutputData: true,
  });

  const ads = http("Meta · Biblioteca de anuncios", [2200, 300], {
    url: "https://graph.facebook.com/v21.0/ads_archive",
    headers: false,
    query: {
      search_terms: "={{ $('Separar despachos').item.json.name }}",
      ad_reached_countries: "['ES']",
      ad_active_status: "ACTIVE",
      ad_type: "ALL",
      fields: "page_name,ad_creative_bodies,ad_delivery_start_time",
      limit: "50",
      access_token: "={{ $env.META_ADS_LIBRARY_TOKEN }}",
    },
    timeout: 20000,
    onError: "continueRegularOutput",
    alwaysOutputData: true,
  });

  const result = code("Juntar análisis", [2420, 300], `// Une, para cada despacho, la web descargada y los anuncios encontrados en Meta.
// La app analiza el HTML (redes, email, formulario, WhatsApp, píxel, si habla de Segunda Oportunidad).
const quitarAcentos = s => (s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const palabras = s => quitarAcentos(s).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !['abogados','abogado','despacho','bufete','asociados'].includes(w));

return $input.all().map((it, i) => {
  const p = $('Separar despachos').all()[i].json;
  const webItem = $('Descargar web').all()[i]?.json ?? {};
  const html = typeof webItem.html === 'string' ? webItem.html.slice(0, 400000) : (typeof webItem.data === 'string' ? webItem.data.slice(0, 400000) : null);

  const out = { id: p.id };
  if (p.website && html) out.html = html;

  // Anuncios: nos quedamos con los de páginas cuyo nombre se parece al del despacho
  const ads = Array.isArray(it.json.data) ? it.json.data : null;
  if (ads) {
    const claves = palabras(p.name);
    const suyos = ads.filter(a => {
      const pn = quitarAcentos(a.page_name);
      return claves.length ? claves.some(w => pn.includes(w)) : false;
    });
    out.meta_ads_active = suyos.length > 0;
    out.meta_ads_count = suyos.length;
    out.meta_ads_lso = suyos.some(a => /segunda oportunidad|deuda|insolven|concurso/i.test((a.ad_creative_bodies || []).join(' ')));
  }
  return { json: out };
});`);

  const enrich = http("Enviar análisis a la app", [2640, 300], {
    method: "POST", url: apiUrl("/api/v1/prospects/enrich"), body: "={{ JSON.stringify($json) }}", timeout: 60000,
    onError: "continueRegularOutput",
  });

  const igUsers = code("Usuarios de Instagram", [2860, 300], `// Junta los usuarios de Instagram (de Google Maps o detectados en la web) en una sola llamada a Apify
if (!$('Configuración').first().json.analizarInstagram) return [{ json: { usuarios: [], porUsuario: {} } }];
const usuarioDe = (url) => {
  const m = (url || '').match(/instagram\\.com\\/([A-Za-z0-9_.]+)/i);
  if (!m) return null;
  const u = m[1].toLowerCase().replace(/\\.$/, '');
  return ['p', 'reel', 'reels', 'explore', 'stories', 'accounts'].includes(u) ? null : u;
};
const porUsuario = {};
$('Separar despachos').all().forEach((it, i) => {
  const detectado = $('Enviar análisis a la app').all()[i]?.json?.detected?.instagram;
  const u = usuarioDe(it.json.instagram) || usuarioDe(detectado);
  if (u) porUsuario[u] = it.json.id;
});
return [{ json: { usuarios: Object.keys(porUsuario), porUsuario } }];`);

  const hasIg = ifNode("¿Hay Instagram?", [3080, 300], "={{ $json.usuarios.length > 0 }}");

  const igApify = http("Apify · Perfiles de Instagram", [3300, 200], {
    method: "POST",
    url: "=https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token={{ $env.APIFY_TOKEN }}&timeout=600",
    headers: false,
    body: "={{ JSON.stringify({ usernames: $json.usuarios }) }}",
    timeout: 600000,
    onError: "continueRegularOutput",
  });

  const igMap = code("Datos de Instagram", [3520, 200], `const porUsuario = $('Usuarios de Instagram').first().json.porUsuario;
const hoy = Date.now();
return $input.all()
  .map(i => i.json)
  .filter(p => p && p.username && porUsuario[p.username.toLowerCase()])
  .map(p => {
    const ultima = (p.latestPosts || []).map(x => x.timestamp).filter(Boolean).sort().at(-1);
    return { json: {
      id: porUsuario[p.username.toLowerCase()],
      instagram: 'https://www.instagram.com/' + p.username,
      instagram_followers: p.followersCount ?? null,
      instagram_days_since_post: ultima ? Math.round((hoy - Date.parse(ultima)) / 864e5) : null,
    } };
  });`);

  const igSend = http("Enviar Instagram a la app", [3740, 200], {
    method: "POST", url: apiUrl("/api/v1/prospects/enrich"), body: "={{ JSON.stringify($json) }}", onError: "continueRegularOutput",
  });

  const summary = code("Resumen", [3960, 300], `const r = $('Enviar despachos a la app').first().json;
return [{ json: { nuevos: r.created, actualizados: r.updated, descartados: r.skipped, analizados: $('Separar despachos').all().length } }];`);

  const tg = telegram("Avisar por Telegram", [4180, 300],
    "=🔎 <b>Prospección terminada</b>\nNuevos: {{ $json.nuevos }} · actualizados: {{ $json.actualizados }} · analizados: {{ $json.analizados }}\n{{ $env.APP_URL }}/prospeccion");
  tg.onError = "continueRegularOutput";

  const manual = node("Lanzar a mano", "n8n-nodes-base.manualTrigger", 1, [220, 200], {});
  const sched = node("Cada lunes 7:00", "n8n-nodes-base.scheduleTrigger", 1.2, [220, 400], {
    rule: { interval: [{ field: "weeks", weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 7 }] },
  });

  const note = sticky(
    "## 01 · Prospección de despachos\nBusca en Google Maps (Apify) despachos de Segunda Oportunidad en las ciudades de **Configuración**, los manda a la app (que limpia, quita duplicados y puntúa) y después analiza cada uno:\n- su **web** (redes, email, formulario, WhatsApp, píxel, si habla de LSO)\n- si **anuncia en Meta** (Biblioteca de anuncios)\n- su **Instagram** (seguidores, días sin publicar)\n\nRellena el nodo **Config**: `LH_API_URL`, `LH_API_KEY`, `APIFY_TOKEN`, `META_ADS_LIBRARY_TOKEN`, `TELEGRAM_CHAT_ID`.\nSolo empresas (B2B): no se recogen datos de particulares.",
    [180, -120], 520, 280, 4,
  );

  save("01-prospeccion-google-maps.json", workflow("01 · Prospección de despachos (Google Maps + Meta + Instagram)",
    [note, manual, sched, cfg, prep, apify, group, send, pending, split, web, ads, result, enrich, igUsers, hasIg, igApify, igMap, igSend, summary, tg],
    [
      ["Lanzar a mano", "Configuración"], ["Cada lunes 7:00", "Configuración"], ["Configuración", "Preparar búsquedas"],
      ["Preparar búsquedas", "Apify · Google Maps"], ["Apify · Google Maps", "Agrupar resultados"], ["Agrupar resultados", "Enviar despachos a la app"],
      ["Enviar despachos a la app", "Despachos sin analizar"], ["Despachos sin analizar", "Separar despachos"], ["Separar despachos", "Descargar web"],
      ["Descargar web", "Meta · Biblioteca de anuncios"], ["Meta · Biblioteca de anuncios", "Juntar análisis"], ["Juntar análisis", "Enviar análisis a la app"],
      ["Enviar análisis a la app", "Usuarios de Instagram"], ["Usuarios de Instagram", "¿Hay Instagram?"],
      ["¿Hay Instagram?", "Apify · Perfiles de Instagram", 0], ["¿Hay Instagram?", "Resumen", 1],
      ["Apify · Perfiles de Instagram", "Datos de Instagram"], ["Datos de Instagram", "Enviar Instagram a la app"], ["Enviar Instagram a la app", "Resumen"],
      ["Resumen", "Avisar por Telegram"],
    ],
  ));
}

// ---------------------------------------------------------------------------
// 02 · Meta Lead Ads -> app
// ---------------------------------------------------------------------------
{
  const trigger = node("Meta · Nuevo lead", "n8n-nodes-base.facebookLeadAdsTrigger", 1, [220, 300], {
    event: "newLead",
    page: { __rl: true, mode: "list", value: "" },
    form: { __rl: true, mode: "list", value: "" },
    options: {},
  }, { webhookId: randomUUID() });

  const map = code("Preparar lead", [440, 300], `// Convierte el lead de Meta al formato de la app. Las preguntas del formulario se mandan tal cual
// en "answers": la app reconoce deuda, acreedores, ingresos, provincia, etc. por palabras clave.
return $input.all().map(({ json: l }) => {
  let answers = {};
  if (Array.isArray(l.field_data)) for (const f of l.field_data) answers[f.name] = Array.isArray(f.values) ? f.values.join(', ') : f.values;
  else if (l.data && typeof l.data === 'object') answers = { ...l.data };
  else for (const [k, v] of Object.entries(l)) if (typeof v !== 'object' && !/^[A-Z0-9_]+$/.test(k)) answers[k] = v; // sin los campos del nodo Config
  const formId = l.form?.id ?? l.form_id ?? null;
  return { json: {
    source: 'meta',
    form_id: formId ? String(formId) : undefined,
    external_id: String(l.id ?? l.leadgen_id ?? ''),
    campaign: l.campaign?.name ?? l.campaign_name ?? null,
    ad_name: l.ad?.name ?? l.ad_name ?? null,
    consent_at: l.created_time ?? new Date().toISOString(),
    consent_text: 'Formulario de Meta Lead Ads' + (l.form?.name ? ' «' + l.form.name + '»' : ''),
    answers,
  } };
});`);

  const send = http("Enviar lead a la app", [660, 300], {
    method: "POST", url: apiUrl("/api/v1/leads"), body: "={{ JSON.stringify($json) }}", timeout: 20000, onError: "continueErrorOutput",
  });
  const fail = telegram("Avisar si falla", [880, 420],
    "=⚠️ <b>Lead de Meta no guardado</b>\n{{ $json.error?.message || JSON.stringify($json).slice(0, 300) }}\nRevisa que el ID del formulario esté en la ficha del cliente.");
  const note = sticky(
    "## 02 · Leads de Meta (Facebook/Instagram)\n1. En **Meta · Nuevo lead** conecta tu credencial de Facebook Lead Ads y elige página y formulario (duplica el flujo si quieres uno por formulario, o deja «todos»).\n2. En la app, pon el **ID del formulario** en la ficha del cliente: así cada lead va a su despacho.\n3. Rellena el nodo **Config** (`LH_API_URL`, `LH_API_KEY`, `TELEGRAM_CHAT_ID`).\n4. La app cualifica el lead y avisa al momento (flujo 04).",
    [160, 20], 520, 220, 4,
  );
  save("02-leads-meta.json", workflow("02 · Leads de Meta Lead Ads → app", [note, trigger, map, send, fail], [
    ["Meta · Nuevo lead", "Preparar lead"], ["Preparar lead", "Enviar lead a la app"], ["Enviar lead a la app", "Avisar si falla", 1],
  ]));
}

// ---------------------------------------------------------------------------
// 03 · Google Ads (formularios de clientes potenciales) -> app
// ---------------------------------------------------------------------------
{
  const hook = node("Webhook Google Ads", "n8n-nodes-base.webhook", 2, [220, 300], {
    httpMethod: "POST", path: "google-ads-leads", responseMode: "onReceived", options: {},
  }, { webhookId: randomUUID() });

  const map = code("Validar y preparar", [440, 300], `// Formato de Google: { lead_id, form_id, campaign_id, google_key, is_test, user_column_data: [{column_id, column_name, string_value}] }
const b = $input.first().json.body ?? $input.first().json;
if (!$env.GOOGLE_ADS_WEBHOOK_KEY || b.google_key !== $env.GOOGLE_ADS_WEBHOOK_KEY) {
  return [{ json: { valido: false, motivo: 'google_key incorrecta' } }];
}
const nombres = { FULL_NAME: 'full_name', FIRST_NAME: 'first_name', LAST_NAME: 'last_name', PHONE_NUMBER: 'phone', EMAIL: 'email', POSTAL_CODE: 'codigo_postal', CITY: 'ciudad', REGION: 'provincia' };
const answers = {};
for (const c of b.user_column_data || []) {
  const k = nombres[c.column_id] || c.column_name || c.column_id;
  answers[k] = c.string_value;
}
return [{ json: {
  valido: true,
  lead: {
    source: 'google',
    form_id: String(b.form_id ?? ''),
    external_id: String(b.lead_id ?? ''),
    campaign: b.campaign_id ? 'Google Ads ' + b.campaign_id : null,
    consent_text: 'Formulario de cliente potencial de Google Ads' + (b.is_test ? ' (PRUEBA)' : ''),
    answers,
  },
} }];`);

  const ok = ifNode("¿Clave correcta?", [660, 300], "={{ $json.valido }}");
  const send = http("Enviar lead a la app", [880, 200], {
    method: "POST", url: apiUrl("/api/v1/leads"), body: "={{ JSON.stringify($json.lead) }}", timeout: 20000, onError: "continueErrorOutput",
  });
  const fail = telegram("Avisar si falla", [1100, 320],
    "=⚠️ <b>Lead de Google no guardado</b>\n{{ $json.error?.message || JSON.stringify($json).slice(0, 300) }}");
  const note = sticky(
    "## 03 · Leads de Google Ads\nEn Google Ads → formulario de clientes potenciales → **Integración de webhook**:\n- URL: `https://TU-N8N/webhook/google-ads-leads`\n- Clave: el valor de `GOOGLE_ADS_WEBHOOK_KEY`\n\nPon el **form_id** en la ficha del cliente de la app. Usa «Enviar datos de prueba» para comprobarlo.",
    [160, 0], 520, 240, 4,
  );
  save("03-leads-google-ads.json", workflow("03 · Leads de Google Ads → app", [note, hook, map, ok, send, fail], [
    ["Webhook Google Ads", "Validar y preparar"], ["Validar y preparar", "¿Clave correcta?"], ["¿Clave correcta?", "Enviar lead a la app", 0],
    ["Enviar lead a la app", "Avisar si falla", 1],
  ]));
}

// ---------------------------------------------------------------------------
// 04 · Eventos de la app: aviso inmediato de leads, citas al despacho, nuevos clientes
// ---------------------------------------------------------------------------
{
  const hook = node("Eventos de la app", "n8n-nodes-base.webhook", 2, [220, 400], {
    httpMethod: "POST", path: "leads-hunters-eventos", responseMode: "onReceived", options: {},
  }, { webhookId: randomUUID() });

  const check = code("Comprobar clave", [440, 400], `const h = $input.first().json.headers || {};
const b = $input.first().json.body || {};
if (h['x-api-key'] !== $env.LH_API_KEY) return [];
return [{ json: { event_id: b.id, kind: b.kind, ...b.payload } }];`);

  const rule = (key) => ({
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
      conditions: [{ id: randomUUID(), leftValue: "={{ $json.kind }}", rightValue: key, operator: { type: "string", operation: "equals" } }],
      combinator: "and",
    },
    renameOutput: true,
    outputKey: key,
  });
  const sw = node("Tipo de evento", "n8n-nodes-base.switch", 3.2, [660, 400], {
    rules: { values: ["lead.nuevo", "cita.agendada", "cita.asistida", "cita.no_asistio", "prospecto.cliente"].map(rule) },
    options: {},
  });

  const tgLead = telegram("🔥 Nuevo lead al equipo", [940, 160],
    "=🔥 <b>Nuevo lead · {{ $json.cliente }}</b>\n{{ $json.nombre }} · {{ $json.telefono }}\nDeuda: {{ $json.deuda ? $json.deuda.toLocaleString('es-ES') + ' €' : '¿?' }} · Acreedores: {{ $json.acreedores ?? '¿?' }} · {{ $json.cualificacion }}\nOrigen: {{ $json.origen }} {{ $json.campana || '' }}\n👉 Llama YA: {{ $env.APP_URL }}/cola");

  const mailClient = email("Email al despacho", [940, 340], {
    to: "={{ $json.cliente_email }}",
    subject: "=Nueva consulta: {{ $json.lead_nombre }} · {{ new Date($json.scheduled_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }) }}",
    html: `=<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">
<h2 style="margin:0 0 12px">Nueva consulta agendada</h2>
<p><b>{{ $json.lead_nombre }}</b> · {{ $json.lead_telefono }}{{ $json.lead_email ? ' · ' + $json.lead_email : '' }}</p>
<p><b>Cuándo:</b> {{ new Date($json.scheduled_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }) }} ({{ $json.mode }})</p>
<table style="border-collapse:collapse;margin:12px 0">
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Deuda total</td><td>{{ $json.deuda ? $json.deuda.toLocaleString('es-ES') + ' €' : '—' }}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Acreedores</td><td>{{ $json.acreedores ?? '—' }}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Ingresos/mes</td><td>{{ $json.ingresos ? $json.ingresos.toLocaleString('es-ES') + ' €' : '—' }}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Situación laboral</td><td>{{ $json.situacion_laboral ?? '—' }}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#64748b">Provincia</td><td>{{ $json.lead_provincia ?? '—' }}</td></tr>
</table>
<p><b>Resumen:</b> {{ ($json.resumen_cualificacion || []).join(' · ') }}</p>
{{ $json.notas_llamada ? '<p><b>Notas de la llamada:</b> ' + $json.notas_llamada + '</p>' : '' }}
<p style="margin-top:20px">Después de la consulta, confirma si se realizó (solo se facturan las realizadas):<br>
<a href="{{ $json.enlace_confirmar }}" style="display:inline-block;margin-top:8px;padding:10px 16px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none">Confirmar asistencia</a></p>
<p style="color:#94a3b8;font-size:12px">Leads Hunters · datos tratados con el consentimiento del interesado para que su despacho estudie su caso.</p></div>`,
  });
  mailClient.onError = "continueRegularOutput";

  const hasLeadEmail = ifNode("¿El lead tiene email?", [1160, 340], "={{ !!$('Tipo de evento').item.json.lead_email }}");
  const mailLead = email("Email de confirmación al lead", [1380, 280], {
    to: "={{ $('Tipo de evento').item.json.lead_email }}",
    subject: "=Tu consulta con {{ $('Tipo de evento').item.json.cliente }} está confirmada",
    html: `=<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">
<p>Hola {{ $('Tipo de evento').item.json.lead_nombre.split(' ')[0] }},</p>
<p>Tu consulta gratuita sobre la Ley de Segunda Oportunidad con <b>{{ $('Tipo de evento').item.json.cliente }}</b> es el
<b>{{ new Date($('Tipo de evento').item.json.scheduled_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }) }}</b>
({{ $('Tipo de evento').item.json.mode }}).</p>
<p>Ten a mano un resumen de tus deudas (bancos, importes) para aprovechar la consulta. Si no puedes asistir, responde a este email.</p>
<p>Un saludo.</p></div>`,
  });
  mailLead.onError = "continueRegularOutput";

  const sms = node("SMS al lead (opcional)", "n8n-nodes-base.twilio", 1, [1380, 460], {
    from: "={{ $env.TWILIO_FROM }}",
    to: "={{ $('Tipo de evento').item.json.lead_telefono }}",
    message: "=Hola, tu consulta con {{ $('Tipo de evento').item.json.cliente }} es el {{ new Date($('Tipo de evento').item.json.scheduled_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }}. Te llamará un abogado especialista.",
    options: {},
  }, { disabled: true, onError: "continueRegularOutput" });

  const tgDone = telegram("✅ Consulta realizada", [940, 540],
    "=✅ Consulta realizada · {{ $json.cliente }} · {{ $json.lead_nombre }} (confirmó: {{ $json.confirmed_by || 'equipo' }})");
  const tgNo = telegram("❌ No se presentó", [940, 700],
    "=❌ No se presentó · {{ $json.cliente }} · {{ $json.lead_nombre }} · {{ $json.lead_telefono }}\nIntenta reagendar: {{ $env.APP_URL }}/leads/{{ $json.lead_id }}");
  const tgClient = telegram("🎉 Nuevo cliente", [940, 860],
    "=🎉 <b>Nuevo cliente:</b> {{ $json.nombre }}\nCompleta su ficha: {{ $env.APP_URL }}/clientes/{{ $json.client_id }}");
  [tgLead, tgDone, tgNo, tgClient].forEach((n) => (n.onError = "continueRegularOutput"));

  const note = sticky(
    "## 04 · Eventos de la app\nLa app llama a este webhook en cada evento (`N8N_EVENTS_WEBHOOK_URL`).\n- **lead.nuevo** → Telegram al equipo para llamar en < 5 min\n- **cita.agendada** → email al despacho con el resumen + enlace para confirmar asistencia, y confirmación al lead (email; SMS con Twilio si lo activas)\n- **cita.asistida / no_asistio** → aviso\n- **prospecto.cliente** → aviso de nuevo cliente\n\nActiva el flujo para que la URL de producción funcione.",
    [160, -40], 560, 300, 4,
  );

  save("04-eventos-app.json", workflow("04 · Eventos de la app (avisos y emails)",
    [note, hook, check, sw, tgLead, mailClient, hasLeadEmail, mailLead, sms, tgDone, tgNo, tgClient],
    [
      ["Eventos de la app", "Comprobar clave"], ["Comprobar clave", "Tipo de evento"],
      ["Tipo de evento", "🔥 Nuevo lead al equipo", 0], ["Tipo de evento", "Email al despacho", 1], ["Tipo de evento", "✅ Consulta realizada", 2],
      ["Tipo de evento", "❌ No se presentó", 3], ["Tipo de evento", "🎉 Nuevo cliente", 4],
      ["Email al despacho", "¿El lead tiene email?"], ["¿El lead tiene email?", "Email de confirmación al lead", 0],
      ["Email al despacho", "SMS al lead (opcional)"],
    ],
  ));
}

// ---------------------------------------------------------------------------
// 05 · Recordatorios de consultas + confirmación de asistencia por el despacho
// ---------------------------------------------------------------------------
{
  const every = node("Cada 30 minutos", "n8n-nodes-base.scheduleTrigger", 1.2, [220, 260], {
    rule: { interval: [{ field: "minutes", minutesInterval: 30 }] },
  });
  const getRem = http("Consultas en las próximas 24 h", [440, 260], {
    url: apiUrl("/api/v1/consultations/reminders"), query: { hours: "24" },
  });
  const split = code("Separar consultas", [660, 260], `return $input.first().json.consultations.map(c => ({ json: c }));`);
  const hasEmail = ifNode("¿Tiene email?", [880, 260], "={{ !!$json.lead_email }}");
  const mail = email("Recordatorio por email", [1100, 160], {
    to: "={{ $json.lead_email }}",
    subject: "=Recordatorio: tu consulta con {{ $json.cliente }}",
    html: `=<div style="font-family:Arial,sans-serif;font-size:14px">
<p>Hola {{ $json.lead_nombre.split(' ')[0] }},</p>
<p>Te recordamos tu consulta sobre la Ley de Segunda Oportunidad con <b>{{ $json.cliente }}</b>:
<b>{{ new Date($json.scheduled_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }) }}</b> ({{ $json.mode }}).</p>
<p>Si no puedes asistir, responde a este email y la cambiamos.</p></div>`,
  });
  mail.onError = "continueRegularOutput";
  const sms = node("Recordatorio por SMS (opcional)", "n8n-nodes-base.twilio", 1, [1100, 360], {
    from: "={{ $env.TWILIO_FROM }}",
    to: "={{ $('Separar consultas').item.json.lead_telefono }}",
    message: "=Recordatorio: consulta con {{ $('Separar consultas').item.json.cliente }} el {{ new Date($('Separar consultas').item.json.scheduled_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }}.",
    options: {},
  }, { disabled: true, onError: "continueRegularOutput" });
  const mark = http("Marcar recordatorio enviado", [1320, 260], {
    method: "POST", url: `=${"{{ $env.LH_API_URL }}"}/api/v1/consultations/{{ $('Separar consultas').item.json.id }}`,
    body: '={"reminder_sent": true}',
  });

  const daily = node("Cada día 20:00", "n8n-nodes-base.scheduleTrigger", 1.2, [220, 620], {
    rule: { interval: [{ field: "days", daysInterval: 1, triggerAtHour: 20 }] },
  });
  const getUnc = http("Consultas pasadas sin confirmar", [440, 620], { url: apiUrl("/api/v1/consultations/unconfirmed") });
  const group = code("Agrupar por despacho", [660, 620], `// Un email por despacho con todas sus consultas pendientes de confirmar
const porCliente = {};
for (const c of $input.first().json.consultations) {
  if (!c.cliente_email) continue;
  (porCliente[c.client_id] ??= { cliente: c.cliente, email: c.cliente_email, consultas: [] }).consultas.push(c);
}
return Object.values(porCliente).map(x => ({ json: {
  ...x,
  filas: x.consultas.map(c => '<li>' + c.lead_nombre + ' · ' + new Date(c.scheduled_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'medium', timeStyle: 'short' }) + ' · <a href="' + c.enlace_confirmar + '">confirmar</a></li>').join(''),
} }));`);
  const mailFirm = email("Pedir confirmación al despacho", [880, 620], {
    to: "={{ $json.email }}",
    subject: "=¿Se realizaron estas consultas? ({{ $json.consultas.length }})",
    html: `=<div style="font-family:Arial,sans-serif;font-size:14px"><p>Hola,</p>
<p>Estas consultas ya han pasado y aún no sabemos si se realizaron. Un clic en cada una nos basta:</p>
<ul>{{ $json.filas }}</ul><p>¡Gracias!</p></div>`,
  });
  mailFirm.onError = "continueRegularOutput";

  const note = sticky(
    "## 05 · Recordatorios de consultas\nCada 30 min: recordatorio al lead de las consultas de las próximas 24 h (email; SMS con Twilio si lo activas). Menos ausencias = más consultas facturables.\n\nLa confirmación diaria de asistencia al despacho está en el flujo 05b.",
    [160, -60], 540, 200, 4,
  );
  const note2 = sticky(
    "## 05b · Confirmación de asistencia\nCada día a las 20:00 manda a cada despacho un email con las consultas ya pasadas que siguen sin confirmar (sin confirmar no se facturan).",
    [160, 440], 540, 140, 4,
  );
  save("05-recordatorios-citas.json", workflow("05 · Recordatorios de consultas",
    [note, every, getRem, split, hasEmail, mail, sms, mark],
    [
      ["Cada 30 minutos", "Consultas en las próximas 24 h"], ["Consultas en las próximas 24 h", "Separar consultas"], ["Separar consultas", "¿Tiene email?"],
      ["¿Tiene email?", "Recordatorio por email", 0], ["¿Tiene email?", "Recordatorio por SMS (opcional)", 1], ["Recordatorio por email", "Marcar recordatorio enviado"],
      ["Recordatorio por SMS (opcional)", "Marcar recordatorio enviado"],
    ],
  ));
  save("05b-confirmar-asistencia.json", workflow("05b · Confirmación de asistencia por el despacho",
    [note2, daily, getUnc, group, mailFirm],
    [["Cada día 20:00", "Consultas pasadas sin confirmar"], ["Consultas pasadas sin confirmar", "Agrupar por despacho"], ["Agrupar por despacho", "Pedir confirmación al despacho"]],
  ));
}

// ---------------------------------------------------------------------------
// 06 · Informe mensual a cada cliente + resumen de facturación
// ---------------------------------------------------------------------------
{
  const sched = node("Día 1 a las 9:00", "n8n-nodes-base.scheduleTrigger", 1.2, [220, 300], {
    rule: { interval: [{ field: "months", monthsInterval: 1, triggerAtDayOfMonth: 1, triggerAtHour: 9 }] },
  });
  const get = http("Resultados del mes anterior", [440, 300], { url: apiUrl("/api/v1/billing") });
  const split = code("Informe por cliente", [660, 300], `const { month, clients } = $input.first().json;
const eur = n => (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const [y, m] = month.split('-').map(Number);
const mes = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
return clients.filter(c => c.email).map(c => ({ json: {
  ...c, mes,
  html: \`<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">
<h2>Resultados de \${mes} · \${c.cliente}</h2>
<table style="border-collapse:collapse">
<tr><td style="padding:6px 16px 6px 0;color:#64748b">Personas interesadas (leads)</td><td><b>\${c.leads}</b></td></tr>
<tr><td style="padding:6px 16px 6px 0;color:#64748b">Cualificadas para la LSO</td><td><b>\${c.leads_cualificados}</b></td></tr>
<tr><td style="padding:6px 16px 6px 0;color:#64748b">Consultas agendadas</td><td><b>\${c.citas_agendadas}</b></td></tr>
<tr><td style="padding:6px 16px 6px 0;color:#64748b">Consultas realizadas</td><td><b>\${c.citas_asistidas}</b></td></tr>
</table>
<h3 style="margin-top:20px">Importe del mes (sin IVA)</h3>
<p>Cuota de marketing: \${eur(c.importe_fijo)}<br>Consultas realizadas: \${c.consultas_facturables} × \${eur(c.price_per_consultation)} = \${eur(c.importe_variable)}<br>
<b>Total: \${eur(c.total)}</b></p>
<p style="color:#64748b;font-size:12px">Servicio de marketing y captación. No es un porcentaje de vuestros honorarios.</p></div>\`,
} }));`);
  const mail = email("Enviar informe", [880, 300], {
    to: "={{ $json.email }}", subject: "=Leads Hunters · resultados de {{ $json.mes }}", html: "={{ $json.html }}",
  });
  mail.onError = "continueRegularOutput";
  const total = code("Total facturación", [1100, 300], `const { month, clients } = $('Resultados del mes anterior').first().json;
const total = clients.reduce((a, c) => a + c.total, 0);
const lineas = clients.map(c => '• ' + c.cliente + ': ' + c.total.toLocaleString('es-ES') + ' € (' + c.citas_asistidas + ' consultas)').join('\\n');
return [{ json: { month, total, lineas } }];`, undefined);
  total.executeOnce = true;
  const tg = telegram("Resumen al dueño", [1320, 300],
    "=💶 <b>Facturación {{ $json.month }}</b>: {{ $json.total.toLocaleString('es-ES') }} € + IVA\n{{ $json.lineas }}\n{{ $env.APP_URL }}/facturacion?mes={{ $json.month }}");
  tg.onError = "continueRegularOutput";
  const note = sticky(
    "## 06 · Informe mensual\nEl día 1 manda a cada despacho sus resultados del mes anterior (leads, cualificados, consultas realizadas e importe) y te pasa el total a facturar por Telegram.",
    [160, 40], 480, 160, 4,
  );
  save("06-informe-mensual.json", workflow("06 · Informe mensual y facturación", [note, sched, get, split, mail, total, tg], [
    ["Día 1 a las 9:00", "Resultados del mes anterior"], ["Resultados del mes anterior", "Informe por cliente"], ["Informe por cliente", "Enviar informe"],
    ["Enviar informe", "Total facturación"], ["Total facturación", "Resumen al dueño"],
  ]));
}

// ---------------------------------------------------------------------------
// 07 · Respaldo: reenvía eventos que no llegaron (si n8n estuvo caído)
// ---------------------------------------------------------------------------
{
  const sched = node("Cada 10 minutos", "n8n-nodes-base.scheduleTrigger", 1.2, [220, 300], {
    rule: { interval: [{ field: "minutes", minutesInterval: 10 }] },
  });
  const get = http("Eventos pendientes", [440, 300], { url: apiUrl("/api/v1/events"), query: { limit: "100" } });
  const split = code("Separar eventos", [660, 300], `// Solo reenviamos eventos con más de 2 minutos (los recientes los está entregando la app)
const limite = Date.now() - 2 * 60 * 1000;
return $input.first().json.events.filter(e => Date.parse(e.created_at) < limite).map(e => ({ json: e }));`);
  const fwd = http("Reenviar al flujo 04", [880, 300], {
    method: "POST",
    url: "={{ $env.N8N_EVENTS_WEBHOOK_URL || 'http://localhost:5678/webhook/leads-hunters-eventos' }}",
    body: "={{ JSON.stringify({ id: $json.id, kind: $json.kind, payload: $json.payload, sent_at: new Date().toISOString() }) }}",
    onError: "continueRegularOutput",
  });
  const ids = code("IDs entregados", [1100, 300], `const ids = $('Separar eventos').all().map(i => i.json.id);
return ids.length ? [{ json: { ids } }] : [];`);
  ids.executeOnce = true;
  const ack = http("Marcar como entregados", [1320, 300], {
    method: "POST", url: apiUrl("/api/v1/events/ack"), body: "={{ JSON.stringify($json) }}",
  });
  const note = sticky("## 07 · Respaldo de eventos\nSi n8n estuvo reiniciándose cuando la app mandó un evento, este flujo lo recoge y lo reenvía al flujo 04. Así ningún lead se queda sin aviso.", [160, 60], 460, 150, 4);
  save("07-respaldo-eventos.json", workflow("07 · Respaldo de eventos", [note, sched, get, split, fwd, ids, ack], [
    ["Cada 10 minutos", "Eventos pendientes"], ["Eventos pendientes", "Separar eventos"], ["Separar eventos", "Reenviar al flujo 04"],
    ["Reenviar al flujo 04", "IDs entregados"], ["IDs entregados", "Marcar como entregados"],
  ]));
}

void API;
