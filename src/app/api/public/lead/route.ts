// POST /api/public/lead — respaldo sin clave del formulario de la web de Recorta.
// La web manda cada solicitud a n8n y, a la vez, aquí: si n8n está caído o apagado, el lead no se pierde.
// Mismos campos que recibe n8n: { nombre, telefono, email, codigoPostal, sector, facturaMensual, interes, tipo, resumen,
//   ahorroAnual, pagina, utm, partner, consentimiento, web (trampa para bots) }.
// Si llega también por n8n, el segundo envío actualiza el mismo lead (mismo teléfono y línea), no lo duplica.
import { NextResponse } from "next/server";
import { planWebForm } from "@/lib/partners";
import { resolveLine } from "@/lib/services/lines";
import { partnerApplication } from "@/lib/services/partners";
import { submitWebLineLead } from "@/lib/services/webLeads";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  if (text.length > 20_000) return json({ ok: false, error: "Demasiado grande" }, 413);
  let form: Record<string, unknown> | null = null;
  try { form = JSON.parse(text); } catch { /* no es JSON */ }
  if (!form || typeof form !== "object" || Array.isArray(form)) return json({ ok: false, error: "JSON no válido" }, 400);

  const plan = planWebForm(form);
  // a los bots se les contesta como si nada, para que no aprendan a esquivar la trampa
  if (plan.kind === "spam") return json({ ok: true });
  if (plan.kind === "invalid") return json({ ok: false, error: plan.error }, 422);
  if (plan.kind === "partner") {
    const r = await partnerApplication({ name: plan.name, kind: plan.partnerKind, phone: plan.phone, email: plan.email, notes: plan.notes });
    return r.ok ? json({ ok: true, partner: r.id, duplicate: r.duplicate }, r.duplicate ? 200 : 201) : json({ ok: false, error: r.error }, 422);
  }

  const results = [];
  for (const formId of plan.forms) {
    const line = await resolveLine(formId);
    if (!line || line.kind === "despachos") { results.push({ form: formId, ok: false, error: "Línea no encontrada" }); continue; }
    const r = await submitWebLineLead(plan.body, line);
    results.push(r.ok ? { form: formId, ok: true, id: r.id, duplicate: r.duplicate } : { form: formId, ok: false, error: r.error });
  }
  const ok = results.some((r) => r.ok);
  return json({ ok, leads: results }, ok ? 201 : 422);
}
