// POST /api/v1/leads — entrada de leads de Meta Lead Ads, Google Ads o webs de los despachos.
// Autenticación: clave maestra de n8n (y entonces hace falta client_id) o la api_key del propio cliente.
// Body: { client_id?, source, external_id?, campaign?, full_name?, phone?, email?, province?, debt_amount?, ...,
//         answers?: { "¿Cuánto debes en total?": "Entre 10.000 y 30.000 €", ... } }
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, clientFromKey, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { ingestLead, type LeadInput } from "@/lib/services/leads";
import { queryOne } from "@/lib/db";

export async function POST(req: Request) {
  const key = apiKeyFrom(req);
  const master = isMasterKey(key);
  const client = master ? null : await clientFromKey(key);
  if (!master && !client) return unauthorized();

  const body = (await req.json().catch(() => null)) as (Partial<LeadInput> & { client_key?: string; form_id?: string }) | null;
  if (!body || typeof body !== "object") return bad("JSON no válido");

  let clientId = client?.id ?? body.client_id ?? null;
  if (!clientId && body.client_key) clientId = (await clientFromKey(body.client_key))?.id ?? null;
  if (!clientId && body.form_id) {
    const col = body.source === "google" ? "google_form_ids" : "meta_form_ids";
    clientId = (await queryOne<{ id: string }>(`SELECT id FROM clients WHERE $1 = ANY(${col})`, [String(body.form_id)]))?.id ?? null;
    if (!clientId) return bad(`Ningún cliente tiene asignado el formulario ${body.form_id}. Añádelo en la ficha del cliente.`, 404);
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
