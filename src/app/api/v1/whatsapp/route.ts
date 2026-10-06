// POST /api/v1/whatsapp — motor del asistente de WhatsApp 24 h (lo llama el flujo 08 de n8n).
// Cabecera x-api-key: la clave de n8n de Ajustes. Body: { phone, text, client_code? } → { reply, done }
import { NextResponse } from "next/server";
import { apiKeyFrom, bad, isMasterKey, unauthorized } from "@/lib/apiAuth";
import { handleWaMessage } from "@/lib/services/waBot";

export async function POST(req: Request) {
  if (!(await isMasterKey(apiKeyFrom(req)))) return unauthorized();
  const b = (await req.json().catch(() => null)) as { phone?: string; text?: string; client_code?: string } | null;
  if (!b?.phone) return bad("Falta phone");
  const r = await handleWaMessage({ phone: String(b.phone), text: String(b.text ?? ""), client_code: b.client_code ?? null });
  return NextResponse.json({ ok: true, ...r });
}
