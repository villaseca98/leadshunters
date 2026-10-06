-- Servicios ampliados: portal del despacho, casos firmados, reseñas, reactivación, publicaciones.

-- Portal privado del despacho (enlace secreto, se puede regenerar)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');
-- Inversión mensual en anuncios que paga el despacho (para el coste real por consulta)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ad_spend_month numeric(10,2);
-- Enlace para dejar reseña en su ficha de Google (Premium)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_review_url text;

-- Casos firmados: el despacho marca qué consultas acabaron en cliente y sus honorarios (solo para su informe de retorno)
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS case_signed boolean;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS case_fee numeric(12,2);
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS case_signed_at timestamptz;
-- Reseñas: cuándo se pidió
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;

-- Reactivación de leads antiguos del despacho
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('meta','google','web','manual','otro','reactivacion'));

-- Publicaciones de Instagram generadas para cada despacho
CREATE TABLE IF NOT EXISTS social_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  month       text NOT NULL,            -- YYYY-MM
  position    integer NOT NULL,         -- 1..12
  template    text NOT NULL,
  title       text NOT NULL,
  slides      jsonb NOT NULL,           -- textos de cada diapositiva
  caption     text NOT NULL,
  status      text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','publicado')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, month, position)
);

-- Conversaciones del asistente de WhatsApp (Premium)
CREATE TABLE IF NOT EXISTS wa_conversations (
  phone       text PRIMARY KEY,
  client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
  step        integer NOT NULL DEFAULT 0,
  answers     jsonb NOT NULL DEFAULT '{}',
  done        boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
