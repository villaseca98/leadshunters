-- Partners (gestorías, administradores de fincas…) que recomiendan Recorta con un enlace con código
-- y se llevan un % de lo que cobramos por cada lead que traen. Se liquida por trimestres.
CREATE TABLE IF NOT EXISTS partners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9-]{2,30}$'),  -- va en el enlace: ?p=CODIGO (no se cambia)
  name          text NOT NULL,
  kind          text NOT NULL DEFAULT 'gestoria'
                CHECK (kind IN ('gestoria','administrador','asociacion','instalador','otro')),
  contact_name  text,
  phone         text,
  email         text,
  nif           text,
  share_pct     numeric(5,2) NOT NULL DEFAULT 20 CHECK (share_pct >= 0 AND share_pct <= 100),
  portal_token  text NOT NULL UNIQUE,
  active        boolean NOT NULL DEFAULT false,   -- false = solicitud desde la web, aún sin acuerdo firmado
  signed_at     date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_payouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  period      text NOT NULL CHECK (period ~ '^\d{4}-T[1-4]$'),
  amount      numeric(10,2) NOT NULL,
  paid_at     timestamptz NOT NULL DEFAULT now(),
  note        text,
  UNIQUE (partner_id, period)
);

-- El código, no el id: así no se pierde la atribución aunque el partner se dé de alta después.
ALTER TABLE line_leads ADD COLUMN IF NOT EXISTS partner_code text;
CREATE INDEX IF NOT EXISTS line_leads_partner_idx ON line_leads(partner_code) WHERE partner_code IS NOT NULL;
