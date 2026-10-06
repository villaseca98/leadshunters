import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    // DATABASE_URL (Docker, Render, Neon en Vercel) o POSTGRES_URL (otras integraciones de Vercel)
    connectionString: process.env.DATABASE_URL ?? process.env.POSTGRES_URL,
    max: process.env.VERCEL ? 3 : 10,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

// numeric -> number (los importes caben de sobra en un double)
import pg from "pg";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
// date (sin hora) como texto "YYYY-MM-DD", para no desplazar el día por la zona horaria
pg.types.setTypeParser(1082, (v) => v);

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
