// POST /api/v1/particulares — entrada desde ManyChat (mensajes directos de Instagram/Facebook) u otro bot.
// Mismo test que /test: reparte la persona al despacho de su provincia o la deja en "Test particulares".
// Cabecera x-api-key: la clave de n8n de Ajustes.
// Body: { full_name, phone, province, email?, debt, creditors, income, employment, home, blockers, consent: true,
//         marketing_ok?, canal?: "instagram", campana? }  · las respuestas valen el código, el texto del botón o el número de opción.
//         También admite los nombres en español: nombre, telefono, provincia, deuda, acreedores, ingresos, situacion, vivienda, impedimentos, acepto.
// Luz y placas (Recorta): añade "linea": "luz" | "placas" (o vertical). Body: { nombre, telefono, provincia, factura, acepto: "si",
//         canal?, campana?, email?, inmueble? (casa, adosado, piso, negocio), propietario? (si/no), compania?, tipo_cliente? (hogar/negocio) }
//         Sin "linea" (o con "despachos") sigue siendo el test de deudas de siempre.
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { QUESTIONS, type TestAnswers } from "@/lib/lsoTest";
import { submitTest } from "@/lib/services/testLeads";
import { submitEnergyLead } from "@/lib/services/energy";
import { parseBill, parseCustomerType, parsePropertyOption, parseVertical, type EnergyVertical } from "@/lib/energia";
import { parseBool } from "@/lib/normalize";

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const yes = (v: unknown) => v === true || ["si", "sí", "true", "1", "acepto", "yes"].includes(norm(v));

export async function POST(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return bad("JSON no válido");

  // Nombres en español (campos de ManyChat) como alias
  const ALIAS: Record<string, string> = {
    nombre: "full_name", telefono: "phone", movil: "phone", provincia: "province", correo: "email",
    deuda: "debt", acreedores: "creditors", ingresos: "income", situacion: "employment", vivienda: "home", impedimentos: "blockers",
    acepto: "consent", consentimiento: "consent",
  };
  for (const [k, v] of Object.entries(ALIAS)) if (b[v] == null && b[k] != null) b[v] = b[k];

  const lineaRaw = b.linea ?? b.vertical ?? b.linea_negocio ?? b.interes;
  const vertical = parseVertical(lineaRaw);
  if (lineaRaw != null && String(lineaRaw).trim() !== "" && !vertical) return bad('Línea no válida. Opciones: despachos, luz, placas');
  if (vertical === "luz" || vertical === "placas") return energia(b, vertical);

  const answers = {} as TestAnswers;
  for (const q of QUESTIONS) {
    const v = norm(b[q.id]);
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

/** Lead de luz o placas para Recorta: no pasa por el test de deudas ni va a ningún despacho. */
async function energia(b: Record<string, unknown>, vertical: EnergyVertical) {
  const pick = (...keys: string[]) => keys.map((k) => b[k]).find((v) => v != null && String(v).trim() !== "");
  const property = parsePropertyOption(pick("inmueble", "tipo_vivienda", "propiedad", "property_type", vertical === "placas" ? "vivienda" : "_"));
  const canal = String(b.canal ?? "instagram");
  const r = await submitEnergyLead({
    vertical,
    full_name: String(b.full_name ?? ""),
    phone: String(b.phone ?? ""),
    email: b.email ? String(b.email) : null,
    province: b.province ? String(b.province) : null,
    monthly_bill: parseBill(pick("factura", "gasto", "monthly_bill", "importe")),
    property_type: property,
    owner: parseBool(pick("propietario", "owner", "es_propietario")),
    supplier: (pick("compania", "comercializadora", "supplier") as string | undefined)?.toString().slice(0, 80) ?? null,
    customer_type: parseCustomerType(pick("tipo_cliente", "cliente", "customer_type"), property),
    consent: yes(b.consent),
    marketing_ok: yes(b.marketing_ok),
    channel: canal,
    campaign: b.campana ? String(b.campana) : null,
    utm: { utm_source: canal, utm_medium: "dm" },
    raw: b,
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 422 });
  const nombre = String(b.full_name ?? "").trim().split(/\s+/)[0] || "";
  return NextResponse.json({
    ok: true, id: r.id, linea: vertical, prioridad: r.priority, duplicado: r.duplicate, resultado: "recibido",
    titulo: `¡Recibido${nombre ? `, ${nombre}` : ""}!`,
    texto: vertical === "luz"
      ? "Te llamamos en breve con tu estudio de ahorro en la factura de la luz. Es gratis y sin compromiso. Ten a mano una factura reciente."
      : "Te llamamos en breve para hacerte el estudio de placas solares de tu vivienda. Es gratis y sin compromiso. Ten a mano una factura de la luz.",
  }, { status: r.duplicate ? 200 : 201 });
}
