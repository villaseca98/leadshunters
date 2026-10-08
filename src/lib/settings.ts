import "server-only";
import { randomBytes } from "node:crypto";
import { query, queryOne } from "./db";

const cache = new Map<string, string>();

export function hasDatabase() {
  return !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

/**
 * Valor de la variable de entorno `name` o, si no existe, una clave aleatoria
 * generada una sola vez y guardada en la base de datos.
 */
export async function secretSetting(name: "SESSION_SECRET" | "N8N_API_KEY"): Promise<string> {
  const env = process.env[name];
  if (env && env.length >= 16) return env;
  const hit = cache.get(name);
  if (hit) return hit;
  await queryOne(`CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
  const prefix = name === "N8N_API_KEY" ? "lh_" : "";
  // ON CONFLICT ... DO UPDATE SET key = EXCLUDED.key devuelve la fila existente si otra instancia ya la creó
  const row = await queryOne<{ value: string }>(
    `INSERT INTO app_settings(key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING value`,
    [name, prefix + randomBytes(24).toString("base64url")],
  );
  cache.set(name, row!.value);
  return row!.value;
}

export function isFromEnv(name: string) {
  const v = process.env[name];
  return !!v && v.length >= 16;
}

export type Contact = { name: string; phone: string; email: string; brand: string; legal: string };

/** Datos de contacto que aparecen en las auditorías. Por defecto, los del primer administrador. */
export async function contactInfo(): Promise<Contact> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM app_settings WHERE key IN ('CONTACT_NAME', 'CONTACT_PHONE', 'CONTACT_EMAIL', 'CONSUMER_BRAND', 'LEGAL_HOLDER')",
  ).catch(() => []);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const admin = await queryOne<{ name: string; email: string }>("SELECT name, email FROM users WHERE role = 'admin' AND active ORDER BY created_at LIMIT 1");
  return { name: s.CONTACT_NAME || admin?.name || "Leads Hunters", phone: s.CONTACT_PHONE || "", email: s.CONTACT_EMAIL || admin?.email || "",
    brand: s.CONSUMER_BRAND || "Mi Cuenta Nueva", legal: s.LEGAL_HOLDER || "" };
}

export async function saveContactInfo(c: Contact) {
  for (const [key, value] of [["CONTACT_NAME", c.name], ["CONTACT_PHONE", c.phone], ["CONTACT_EMAIL", c.email], ["CONSUMER_BRAND", c.brand], ["LEGAL_HOLDER", c.legal]]) {
    await query(
      "INSERT INTO app_settings(key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [key, value.trim()],
    );
  }
}
