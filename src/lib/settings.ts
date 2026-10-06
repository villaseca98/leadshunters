import "server-only";
import { randomBytes } from "node:crypto";
import { queryOne } from "./db";

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
