// Aplica las migraciones SQL de db/migrations en orden. Uso: node scripts/migrate.mjs
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? process.env.POSTGRES_URL });

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    // primer despliegue en Vercel antes de conectar la base de datos: no bloquea el build
    console.warn("⚠ Sin DATABASE_URL: no se aplican migraciones. Conecta la base de datos y vuelve a desplegar.");
    return;
  }
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = await readFile(path.join(dir, f), "utf8");
    console.log(`→ aplicando ${f}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [f]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  console.log("✓ base de datos al día");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
