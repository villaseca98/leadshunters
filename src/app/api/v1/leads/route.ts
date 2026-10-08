// POST /api/v1/leads — entrada de leads de Meta Lead Ads, Google Ads o webs de los despachos.
// Autenticación: clave maestra de n8n (y entonces hace falta client_id) o la api_key del propio cliente.
// Body: { client_id?, form_id?, source, external_id?, campaign?, full_name?, phone?, email?, province?, debt_amount?, ...,
//         luz/placas: monthly_bill?, tariff?, business_type?, postal_code?, roof?, daytime_share?, energy?: {...},
//         answers?: { "¿Cuánto debes en total?": "Entre 10.000 y 30.000 €", ... } }
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, clientFromKey, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { ingestLead, type LeadInput } from "@/lib/services/leads";
import { queryOne } from "@/lib/db";
import { extractData, type Line } from "@/lib/lineas";
import { resolveLine, submitLineLead } from "@/lib/services/lines";

/** Lead del formulario web de una empresa (Recorta, MewHub…) en su línea. Los datos de energía se pasan a las preguntas de la línea. */
async function webLineLead(b: Record<string, unknown>, line: Line) {
  const s = (k: string) => (b[k] == null ? undefined : String(b[k]));
  const energy = (b.energy && typeof b.energy === "object" ? b.energy : {}) as Record<string, unknown>;
  const roof = s("roof") ?? (energy.roof as string | undefined);
  const mapped: Record<string, unknown> = {
    ...energy,
    ...b,
    factura: b.factura ?? b.monthly_bill ?? energy.monthly_bill,
    compania: b.compania ?? b.current_supplier ?? energy.current_supplier,
    tipo_cliente: b.tipo_cliente ?? (b.business_type || energy.business_type ? "negocio" : undefined),
    propietario: b.propietario ?? (roof ? (/propi/.test(roof) ? "si" : "no") : undefined),
  };
  for (const k of ["energy", "answers", "client_id", "client_key", "form_id", "source", "external_id", "full_name", "phone", "email", "province", "consent_text", "consent_at", "consent", "monthly_bill", "current_supplier", "roof"]) delete mapped[k];
  const r = await submitLineLead({
    line,
    full_name: s("full_name") ?? "",
    phone: s("phone") ?? "",
    email: s("email") ?? null,
    province: s("province") ?? null,
    data: extractData(line.fields, mapped),
    // el formulario web solo se envía con la casilla de consentimiento marcada
    consent: b.consent !== false,
    channel: s("source") === "web" || !s("source") ? "web" : s("source")!,
    campaign: s("campaign") ?? `web-${line.slug}`,
    raw: b,
  });
  if (!r.ok) return bad(r.error);
  return NextResponse.json({ ok: true, linea: line.slug, empresa: line.company_name, id: r.id, duplicate: r.duplicate, prioridad: r.priority }, { status: r.duplicate ? 200 : 201 });
}

export async function POST(req: Request) {
  const key = apiKeyFrom(req);
  const master = await isMasterKey(key);
  const client = master ? null : await clientFromKey(key);
  if (!master && !client) return unauthorized();

  const body = (await req.json().catch(() => null)) as (Partial<LeadInput> & { client_key?: string; form_id?: string }) | null;
  if (!body || typeof body !== "object") return bad("JSON no válido");

  let clientId = client?.id ?? body.client_id ?? null;
  if (!clientId && body.client_key) clientId = (await clientFromKey(body.client_key))?.id ?? null;
  if (!clientId && body.form_id) {
    // Busca primero en la columna del origen y, si no, en cualquiera (formularios web propios como recorta-luz)
    const col = body.source === "google" ? "google_form_ids" : body.source === "web" ? "web_form_ids" : "meta_form_ids";
    clientId = (await queryOne<{ id: string }>(
      `SELECT id FROM clients WHERE $1 = ANY(${col})
       UNION ALL SELECT id FROM clients WHERE $1 = ANY(web_form_ids) OR $1 = ANY(meta_form_ids) OR $1 = ANY(google_form_ids)
       LIMIT 1`,
      [String(body.form_id)],
    ))?.id ?? null;
    if (!clientId) {
      // formularios de las webs de las empresas (recorta-luz, recorta-placas, mewhub-web…): entran como leads de su línea
      const line = await resolveLine(body.form_id);
      if (line && line.kind !== "despachos") return webLineLead(body as Record<string, unknown>, line);
      return bad(`Ningún cliente ni línea tiene el formulario ${body.form_id}. Añádelo en la ficha del cliente o como palabra clave de la línea.`, 404);
    }
  }
  if (!clientId) return bad("Falta client_id, client_key o form_id para saber de qué despacho es el lead");
  if (!body.full_name && !body.phone && !body.answers) return bad("El lead no trae nombre, teléfono ni respuestas");

  try {
    const r = await ingestLead({ ...body, client_id: clientId } as LeadInput);
    return NextResponse.json({ ok: true, ...r }, { status: r.duplicate ? 200 : 201 });
  } catch (e) {
    return bad((e as Error).message);
  }
}
