import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { queryOne } from "./db";
import { secretSetting } from "./settings";

/** Clave maestra para n8n: cabecera `x-api-key` o `Authorization: Bearer ...` */
export function apiKeyFrom(req: Request): string | null {
  const h = req.headers.get("x-api-key");
  if (h) return h.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return new URL(req.url).searchParams.get("api_key");
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function isMasterKey(key: string | null) {
  if (!key) return false;
  const master = await secretSetting("N8N_API_KEY");
  return master.length >= 16 && safeEq(key, master);
}

export function unauthorized() {
  return NextResponse.json({ ok: false, error: "API key inválida" }, { status: 401 });
}

/** Devuelve el cliente si la clave es la de un cliente (para formularios web propios del despacho). */
export async function clientFromKey(key: string | null) {
  if (!key) return null;
  return queryOne<{ id: string; name: string }>("SELECT id, name FROM clients WHERE api_key = $1", [key]);
}

export function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}
