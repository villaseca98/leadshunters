-- Ajustes internos generados por la propia app (clave de sesión, clave de n8n),
-- para no depender de variables de entorno en Vercel.
CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
