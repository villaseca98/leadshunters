-- Respuestas del test público "¿Puedo cancelar mis deudas?" (/test).
-- Si hay un despacho cliente en su provincia, también se crea el lead (lead_id).
-- Las que no tienen despacho son el argumento de venta: "tengo X personas de tu provincia esperando".
CREATE TABLE IF NOT EXISTS test_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text NOT NULL,
  phone         text NOT NULL,
  email         text,
  province      text,
  answers       jsonb NOT NULL,
  verdict       text NOT NULL CHECK (verdict IN ('apto','revisar','no_apto')),
  consent_text  text NOT NULL,
  consent_at    timestamptz NOT NULL DEFAULT now(),
  marketing_ok  boolean NOT NULL DEFAULT false,
  utm           jsonb NOT NULL DEFAULT '{}',
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  lead_id       uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS test_submissions_province_idx ON test_submissions(province, created_at);
