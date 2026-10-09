// Portadas de los reels (1080×1920, JPG) para Instagram: un fotograma real del vídeo, la marca de la empresa y el gancho.
// Uso: node scripts/portadas-reels.mjs [filtro]   → public/reels/portadas/<video>.jpg
// Las marcas (Leads Hunters, Mi Cuenta Nueva, Recorta, MewHub) y los títulos están en scripts/portadas.json.
// El título admite *resaltado* con el color de la marca. Necesita ffmpeg y Playwright con Chromium.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const cfg = JSON.parse(readFileSync(join(root, "scripts/portadas.json"), "utf8"));
const muestras = process.argv[2] === "--muestras"; // una portada de ejemplo por marca, para ver cómo queda cada empresa
const filtro = muestras ? "" : process.argv[2] ?? "";
const EJEMPLO = {
  "leads-hunters": ["Consultas *que sí son casos*", "Para despachos"],
  micuentanueva: ["¿Deudas que no puedes pagar? *Hay salida.*", "Ley de Segunda Oportunidad"],
  recorta: ["Tu factura de la luz, *más baja*", "Ahorro en casa"],
  mewhub: ["Tu web, *trayendo clientes*", "Diseño y mantenimiento"],
};
let pw;
try { pw = await import("playwright"); } catch { pw = (await import(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright/index.js")).default; }

const tmp = join(tmpdir(), "portadas-reels");
mkdirSync(tmp, { recursive: true });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const crosshair = (c) => `<svg viewBox="0 0 48 48" width="72" height="72"><circle cx="24" cy="24" r="19" fill="none" stroke="${c}" stroke-width="4.5"/><circle cx="24" cy="24" r="8" fill="${c}"/><path d="M24 0v11M24 37v11M0 24h11M37 24h11" stroke="${c}" stroke-width="4.5"/></svg>`;
// todo en línea (data:) porque la página se carga con setContent y no puede leer file://
const data = (f, type) => `data:${type};base64,${readFileSync(f).toString("base64")}`;
const font = (w, f) => `@font-face{font-family:D;font-weight:${w};src:url(${data(f, "font/otf")})}`;

function html(r, frame) {
  const m = cfg.marcas[r.marca];
  const titulo = esc(r.titulo).replace(/\*(.+?)\*/g, `<em>$1</em>`);
  const icono = m.icono === "crosshair" ? crosshair(m.color) : `<span class="emo">${m.icono}</span>`;
  const largo = r.titulo.replace(/\*/g, "").length;
  const size = largo > 38 ? 104 : largo > 28 ? 118 : 132;
  return `<!doctype html><meta charset="utf-8"><style>
${font(900, "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf")}
${font(600, "/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf")}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;font-family:D,sans-serif;color:${m.texto};background:${m.fondo} ${frame ? `url(${data(frame, "image/png")}) center bottom/cover` : ""}}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,${m.fondo} 0%,${m.fondo} 48%,${m.fondo}d9 53%,${m.fondo}00 64%,${m.fondo}00 80%,${m.fondo}e6 90%,${m.fondo} 100%)}
.art{position:absolute;inset:0;background:radial-gradient(60% 40% at 15% 8%,${m.color}55,transparent 70%),radial-gradient(70% 40% at 90% 95%,${m.color}33,transparent 70%),${m.fondo}}
.art svg{position:absolute;right:-220px;bottom:180px;width:900px;height:900px;opacity:.16}
.art .big{position:absolute;right:-120px;bottom:260px;font-size:720px;line-height:1;opacity:.14;filter:saturate(.6)}
.top{position:absolute;left:84px;right:84px;top:300px}
.brand{display:flex;align-items:center;gap:22px}
.emo{font-size:64px;line-height:1;display:grid;place-items:center;width:96px;height:96px;border-radius:28px;background:${m.color}26}
.brand b{display:block;font-size:46px;font-weight:900;letter-spacing:-.5px}
.brand small{display:block;font-size:28px;font-weight:600;opacity:.75;margin-top:2px}
.tag{display:inline-block;margin-top:64px;padding:12px 26px;border-radius:999px;background:${m.color};color:${m.fondo};font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:2px}
h1{margin-top:30px;font-size:${size}px;line-height:1.02;font-weight:900;letter-spacing:-2px;text-wrap:balance;text-shadow:0 4px 30px #0008}
em{font-style:normal;color:${m.color}}
.bar{position:absolute;left:84px;right:84px;top:1600px;display:flex;justify-content:space-between;align-items:center;font-size:28px;font-weight:600}
.bar i{display:block;height:8px;width:180px;border-radius:9px;background:${m.color}}
</style>${frame ? `<div class="shade"></div>` : `<div class="art">${m.icono === "crosshair" ? crosshair(m.color).replace(/width="72" height="72"/, "") : `<span class="big">${m.icono}</span>`}</div>`}
<div class="top"><div class="brand">${icono}<div><b>${esc(m.nombre)}</b><small>${esc(m.lema)}</small></div></div>
${r.etiqueta ? `<span class="tag">${esc(r.etiqueta)}</span>` : ""}<h1>${titulo}</h1></div>
<div class="bar"><i></i><span>▶ Mira el reel</span></div>`;
}

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
let n = 0;
const lista = muestras
  ? Object.keys(cfg.marcas).map((k) => ({ video: `muestras/${k}`, marca: k, titulo: EJEMPLO[k]?.[0] ?? cfg.marcas[k].lema, etiqueta: EJEMPLO[k]?.[1], fondo: "marca" }))
  : cfg.reels.filter((x) => x.video.includes(filtro));
for (const r of lista) {
  const video = join(root, "public/reels", `${r.video}.mp4`);
  const dur = r.fondo === "marca" ? 0 : Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).toString());
  // fotograma a mitad del vídeo (escena con personaje), salvo que el json diga otro segundo; "fondo": "marca" usa solo los colores de la marca
  const frame = r.fondo === "marca" ? null : join(tmp, `${r.video.replace(/\//g, "_")}.png`);
  if (frame) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(r.segundo ?? (dur * 0.45).toFixed(2)), "-i", video, "-frames:v", "1", frame]);
  await page.setContent(html(r, frame), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const out = join(root, "public/reels/portadas", `${r.video}.jpg`);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: "jpeg", quality: 88 });
  n++;
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`${n} portadas en public/reels/portadas/`);
