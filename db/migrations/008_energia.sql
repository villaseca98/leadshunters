-- Segunda línea de negocio: afiliación de luz y placas solares (Recorta).
-- Leads de particulares que llegan por Instagram (ManyChat) u otro bot, con consentimiento. No van a ningún despacho.
CREATE TABLE IF NOT EXISTS energy_leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical          text NOT NULL CHECK (vertical IN ('luz','placas')),
  full_name         text NOT NULL,
  phone             text NOT NULL,
  email             text,
  province          text,
  monthly_bill      numeric(10,2),             -- factura de la luz al mes
  property_type     text,                      -- casa, adosado, piso, negocio, otro
  owner             boolean,                   -- propietario de la vivienda (placas)
  supplier          text,                      -- comercializadora actual (luz)
  customer_type     text NOT NULL DEFAULT 'hogar' CHECK (customer_type IN ('hogar','negocio')),
  priority          text NOT NULL DEFAULT 'B' CHECK (priority IN ('A','B','C')),
  priority_reasons  jsonb NOT NULL DEFAULT '[]',
  status            text NOT NULL DEFAULT 'nuevo'
                    CHECK (status IN ('nuevo','no_contesta','contactado','estudio_enviado','contratado','descartado')),
  attempts          integer NOT NULL DEFAULT 0,
  first_contact_at  timestamptz,
  last_contact_at   timestamptz,
  converted_at      timestamptz,
  commission        numeric(10,2),             -- comisión cobrada por el contrato
  lost_reason       text,
  notes             text,
  channel           text NOT NULL DEFAULT 'instagram',
  campaign          text,
  utm               jsonb NOT NULL DEFAULT '{}',
  consent_text      text NOT NULL,
  consent_at        timestamptz NOT NULL DEFAULT now(),
  marketing_ok      boolean NOT NULL DEFAULT false,
  raw               jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS energy_leads_vertical_idx ON energy_leads(vertical, created_at DESC);
CREATE INDEX IF NOT EXISTS energy_leads_status_idx ON energy_leads(status, created_at);
CREATE INDEX IF NOT EXISTS energy_leads_phone_idx ON energy_leads(phone);
