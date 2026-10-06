// Crea el usuario administrador (y datos de ejemplo con --demo).
// Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed.mjs [--demo]
import pg from "pg";
import bcrypt from "bcryptjs";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const email = (process.env.ADMIN_EMAIL ?? "admin@leadshunters.local").toLowerCase();
const password = process.env.ADMIN_PASSWORD;

async function main() {
  await db.connect();
  if (!password || password.length < 8) {
    console.error("Define ADMIN_PASSWORD (mínimo 8 caracteres) en el .env");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO users(name, email, password_hash, role) VALUES ($1,$2,$3,'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', active = true`,
    [process.env.ADMIN_NAME ?? "Administrador", email, hash],
  );
  console.log(`✓ admin: ${email}`);

  if (process.argv.includes("--demo")) {
    const { rows: [c] } = await db.query(
      `INSERT INTO clients(name, contact_name, contact_phone, contact_email, notify_email, city, provinces, meta_form_ids)
       VALUES ('Despacho Demo Segunda Oportunidad', 'Laura Demo', '+34600000000', 'demo@example.com', 'demo@example.com', 'Valencia', '{Valencia,Alicante,Castellón}', '{123456789}')
       ON CONFLICT DO NOTHING RETURNING id`,
    );
    if (c) console.log(`✓ cliente demo: ${c.id}`);
    console.log("  Para generar leads y despachos de ejemplo usa la API (ver README, sección «Probar sin anuncios»).");
  }
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
