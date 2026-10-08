// POST /api/v1/particulares — entrada desde ManyChat (mensajes directos de Instagram/Facebook) u otro bot.
// Mismo test que /test: reparte la persona al despacho de su provincia o la deja en "Test particulares".
// Cabecera x-api-key: la clave de n8n de Ajustes.
// Body: { full_name, phone, province, email?, debt, creditors, can_pay?, public_debt?, special_debt?, income, employment, home, blockers, consent: true,
//         marketing_ok?, canal?: "instagram", campana? }  · las respuestas valen el código, el texto del botón o el número de opción.
//         También admite los nombres en español: nombre, telefono, provincia, deuda, acreedores, puede_pagar, deuda_publica, deuda_especial,
//         ingresos, situacion, vivienda, impedimentos, acepto.
// Otras empresas y líneas (Recorta luz, placas… ver Empresas y líneas en la app): añade "linea": "<slug, nombre o palabra clave>".
//         Body: { linea, nombre, telefono, provincia?, email?, acepto: "si", canal?, campana?, ...las preguntas de esa línea }
//         Cualquier otro campo que mande ManyChat se guarda también en el lead. Sin "linea" (o "despachos") es el test de deudas.
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { LEGACY_VALUES, OPTIONAL_ANSWERS, QUESTIONS, type TestAnswers } from "@/lib/lsoTest";
import { submitTest } from "@/lib/services/testLeads";
import { extractData } from "@/lib/lineas";
import { resolveLine, submitLineLead } from "@/lib/services/lines";

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const yes = (v: unknown) => v === true || ["si", "sí", "true", "1", "acepto", "yes"].includes(norm(v));

export async function POST(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return bad("JSON no válido");

  const lineaRaw = b.linea ?? b.vertical ?? b.linea_negocio ?? b.interes;
  if (lineaRaw != null && String(lineaRaw).trim() !== "") {
    const line = await resolveLine(lineaRaw);
    if (!line) return bad(`Línea no encontrada: "${String(lineaRaw).slice(0, 60)}". Créala en la app, en Empresas y líneas.`, 404);
    if (line.kind !== "despachos") return otraLinea(b, line);
  }

  // Nombres en español (campos de ManyChat) como alias
  const ALIAS: Record<string, string> = {
    nombre: "full_name", telefono: "phone", movil: "phone", provincia: "province", correo: "email",
    deuda: "debt", acreedores: "creditors", puede_pagar: "can_pay", deuda_publica: "public_debt", deuda_especial: "special_debt", ingresos: "income", situacion: "employment", vivienda: "home", impedimentos: "blockers",
    acepto: "consent", consentimiento: "consent",
  };
  for (const [k, v] of Object.entries(ALIAS)) if (b[v] == null && b[k] != null) b[v] = b[k];

  const answers = {} as TestAnswers;
  for (const q of QUESTIONS) {
    if (b[q.id] == null && OPTIONAL_ANSWERS.includes(q.id)) continue;
    const raw = norm(b[q.id]);
    const v = LEGACY_VALUES[q.id]?.[raw] ?? raw;
    // vale el código, el texto del botón o el número de la opción (1, 2, 3...)
    const opt = q.options.find((o) => norm(o.value) === v || norm(o.label) === v) ?? (/^\d$/.test(v) ? q.options[Number(v) - 1] : undefined);
    if (!opt) return bad(`Respuesta no válida en "${q.id}". Opciones: ${q.options.map((o) => o.value).join(", ")}`);
    answers[q.id] = opt.value;
  }
  const canal = String(b.canal ?? "instagram");
  const r = await submitTest({
    answers,
    full_name: String(b.full_name ?? ""),
    phone: String(b.phone ?? ""),
    email: b.email ? String(b.email) : undefined,
    province: String(b.province ?? ""),
    consent: yes(b.consent),
    marketing_ok: yes(b.marketing_ok),
    utm: { utm_source: canal, utm_medium: "dm", utm_campaign: String(b.campana ?? `${canal}-dm`) },
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 });
  return NextResponse.json({ ok: true, resultado: r.verdict.kind, titulo: r.verdict.title, texto: r.verdict.text }, { status: 201 });
}

/** Lead de cualquier otra línea (Recorta luz, placas…): no pasa por el test de deudas ni va a ningún despacho. */
async function otraLinea(b: Record<string, unknown>, line: NonNullable<Awaited<ReturnType<typeof resolveLine>>>) {
  const pick = (...keys: string[]) => keys.map((k) => b[k]).find((v) => v != null && String(v).trim() !== "");
  const nombre = String(pick("nombre", "full_name", "name") ?? [b.first_name, b.last_name].filter(Boolean).join(" ")).trim();
  const canal = String(b.canal ?? "instagram");
  const r = await submitLineLead({
    line,
    full_name: nombre,
    phone: String(pick("telefono", "phone", "movil", "phone_number") ?? ""),
    email: (pick("email", "correo") as string | undefined) ?? null,
    province: (pick("provincia", "province") as string | undefined) ?? null,
    data: extractData(line.fields, b),
    consent: yes(pick("acepto", "consent", "consentimiento")),
    marketing_ok: yes(b.marketing_ok),
    channel: canal,
    campaign: b.campana ? String(b.campana) : null,
    utm: { utm_source: canal, utm_medium: "dm" },
    raw: b,
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 });
  const first = nombre.split(/\s+/)[0] || "";
  return NextResponse.json({
    ok: true, id: r.id, empresa: line.company_name, linea: line.slug, prioridad: r.priority, duplicado: r.duplicate, resultado: "recibido",
    titulo: `¡Recibido${first ? `, ${first}` : ""}!`, texto: line.thanks_text,
  }, { status: r.duplicate ? 200 : 201 });
}
