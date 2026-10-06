// POST /api/v1/particulares — entrada desde ManyChat (mensajes directos de Instagram/Facebook) u otro bot.
// Mismo test que /test: reparte la persona al despacho de su provincia o la deja en "Test particulares".
// Cabecera x-api-key: la clave de n8n de Ajustes.
// Body: { full_name, phone, province, email?, debt, creditors, income, employment, home, blockers, consent: true,
//         marketing_ok?, canal?: "instagram", campana? }  · las respuestas valen el código, el texto del botón o el número de opción.
//         También admite los nombres en español: nombre, telefono, provincia, deuda, acreedores, ingresos, situacion, vivienda, impedimentos, acepto.
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { QUESTIONS, type TestAnswers } from "@/lib/lsoTest";
import { submitTest } from "@/lib/services/testLeads";

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
