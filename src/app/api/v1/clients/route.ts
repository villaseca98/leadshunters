// GET /api/v1/clients — lista de despachos activos (para que n8n sepa a qué cliente va cada formulario)
import { NextResponse } from "next/server";
import { apiKeyFrom, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const rows = await query("SELECT id, name, status, notify_email, provinces FROM clients ORDER BY name");
  return NextResponse.json({ ok: true, clients: rows });
}
