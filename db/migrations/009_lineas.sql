-- Leads Hunters como matriz: varias empresas, cada una con sus líneas de negocio y sus propios campos.
-- Despachos (Segunda Oportunidad) sigue en sus tablas de siempre (leads, clients…); aquí solo aparece como línea "integrada".
-- Las demás líneas guardan sus leads en line_leads, con los campos propios de cada línea en "data".

CREATE TABLE IF NOT EXISTS companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  website     text,
  notes       text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  slug            text NOT NULL UNIQUE,         -- lo que manda ManyChat en "linea"
  name            text NOT NULL,
  emoji           text NOT NULL DEFAULT '•',
  kind            text NOT NULL DEFAULT 'generica' CHECK (kind IN ('despachos','generica')),
  keywords        text[] NOT NULL DEFAULT '{}', -- palabras que también identifican la línea (LUZ, factura…)
  fields          jsonb NOT NULL DEFAULT '[]',  -- preguntas propias: [{key,label,type,options:[{label,value,points}],aliases,points_yes,points_no}]
  priority_a      integer NOT NULL DEFAULT 2,   -- puntos para prioridad A
  priority_b      integer NOT NULL DEFAULT 0,   -- puntos para prioridad B (por debajo, C)
  consent_text    text NOT NULL DEFAULT '',
  thanks_text     text NOT NULL DEFAULT 'Te llamamos en breve. Es gratis y sin compromiso.',
  proposal_label  text NOT NULL DEFAULT 'Propuesta enviada',
  won_label       text NOT NULL DEFAULT 'Cerrado',
  value_label     text NOT NULL DEFAULT 'Comisión',
  default_value   numeric(10,2),                -- lo que sueles cobrar por cierre (se propone al cerrar)
  active          boolean NOT NULL DEFAULT true,
  position        integer NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id           uuid NOT NULL REFERENCES business_lines(id) ON DELETE RESTRICT,
  full_name         text NOT NULL,
  phone             text NOT NULL,
  email             text,
  province          text,
  data              jsonb NOT NULL DEFAULT '{}',  -- respuestas a las preguntas de la línea y cualquier dato extra
  priority          text NOT NULL DEFAULT 'B' CHECK (priority IN ('A','B','C')),
  priority_points   integer NOT NULL DEFAULT 0,
  priority_reasons  jsonb NOT NULL DEFAULT '[]',
  status            text NOT NULL DEFAULT 'nuevo'
                    CHECK (status IN ('nuevo','no_contesta','contactado','propuesta','ganado','descartado')),
  attempts          integer NOT NULL DEFAULT 0,
  next_call_at      timestamptz NOT NULL DEFAULT now(),
  locked_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  locked_at         timestamptz,
  first_contact_at  timestamptz,
  last_contact_at   timestamptz,
  won_at            timestamptz,
  value             numeric(10,2),                -- comisión o importe cobrado por el cierre
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
CREATE INDEX IF NOT EXISTS line_leads_line_idx ON line_leads(line_id, created_at DESC);
CREATE INDEX IF NOT EXISTS line_leads_queue_idx ON line_leads(status, next_call_at);
CREATE INDEX IF NOT EXISTS line_leads_phone_idx ON line_leads(phone);

-- Empresas y líneas de partida
INSERT INTO companies(slug, name, notes) VALUES
  ('leads-hunters', 'Leads Hunters', 'Matriz. Captación para despachos de Segunda Oportunidad.'),
  ('recorta', 'Recorta', 'Afiliación de luz y placas solares.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO business_lines(company_id, slug, name, emoji, kind, keywords, position, consent_text, won_label, proposal_label, value_label)
SELECT id, 'despachos', 'Despachos (Segunda Oportunidad)', '⚖️', 'despachos', '{deudas,lso,segunda oportunidad,abogado}', 0,
       'Texto del test de deudas (ver /test).', 'Consulta realizada', 'Consulta agendada', 'Facturación'
  FROM companies WHERE slug = 'leads-hunters'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO business_lines(company_id, slug, name, emoji, keywords, fields, priority_a, priority_b, consent_text, thanks_text, proposal_label, won_label, value_label, position)
SELECT id, 'luz', 'Luz', '💡', '{luz,electricidad,factura,tarifa,energia}',
  '[
    {"key":"factura","label":"Factura de la luz al mes","type":"select","aliases":["gasto","monthly_bill","importe"],
     "options":[{"label":"Menos de 50 €","value":"40","points":-1},{"label":"Entre 50 y 100 €","value":"75","points":1},
                {"label":"Entre 100 y 200 €","value":"150","points":2},{"label":"Más de 200 €","value":"250","points":3}]},
    {"key":"tipo_cliente","label":"¿Hogar o negocio?","type":"select","aliases":["cliente","customer_type"],
     "options":[{"label":"Hogar","value":"hogar","points":0},{"label":"Negocio","value":"negocio","points":1}]},
    {"key":"compania","label":"Compañía actual","type":"text","aliases":["comercializadora","supplier"]}
  ]'::jsonb, 2, 1,
  'Acepto la política de privacidad y que Recorta o una comercializadora colaboradora me contacte por teléfono, WhatsApp o email para darme un estudio de ahorro en mi factura de la luz.',
  'Te llamamos en breve con tu estudio de ahorro en la factura de la luz. Es gratis y sin compromiso. Ten a mano una factura reciente.',
  'Estudio enviado', 'Contratado', 'Comisión', 10
  FROM companies WHERE slug = 'recorta'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO business_lines(company_id, slug, name, emoji, keywords, fields, priority_a, priority_b, consent_text, thanks_text, proposal_label, won_label, value_label, position)
SELECT id, 'placas', 'Placas solares', '☀️', '{placas,solar,fotovoltaica,autoconsumo,paneles}',
  '[
    {"key":"factura","label":"Factura de la luz al mes","type":"select","aliases":["gasto","monthly_bill","importe"],
     "options":[{"label":"Menos de 50 €","value":"40","points":-2},{"label":"Entre 50 y 100 €","value":"75","points":1},
                {"label":"Entre 100 y 200 €","value":"150","points":2},{"label":"Más de 200 €","value":"250","points":3}]},
    {"key":"inmueble","label":"¿Dónde vives?","type":"select","aliases":["vivienda","tipo_vivienda","propiedad","property_type"],
     "options":[{"label":"Casa o chalet","value":"casa","points":2},{"label":"Adosado","value":"adosado","points":2},
                {"label":"Piso","value":"piso","points":-5},{"label":"Negocio o nave","value":"negocio","points":2}]},
    {"key":"propietario","label":"¿Eres el propietario?","type":"bool","aliases":["owner","es_propietario"],"points_yes":1,"points_no":-5}
  ]'::jsonb, 4, 1,
  'Acepto la política de privacidad y que Recorta o un instalador colaborador me contacte por teléfono, WhatsApp o email para darme un estudio de placas solares.',
  'Te llamamos en breve para hacerte el estudio de placas solares de tu vivienda. Es gratis y sin compromiso. Ten a mano una factura de la luz.',
  'Estudio enviado', 'Contratado', 'Comisión', 20
  FROM companies WHERE slug = 'recorta'
ON CONFLICT (slug) DO NOTHING;

-- Pasa los leads que ya hubiera en energy_leads (versión anterior, solo luz y placas) y la retira
DO $$
BEGIN
  IF to_regclass('public.energy_leads') IS NOT NULL THEN
    INSERT INTO line_leads(id, line_id, full_name, phone, email, province, data, priority, priority_reasons, status, attempts,
                           first_contact_at, last_contact_at, won_at, value, lost_reason, notes, channel, campaign, utm,
                           consent_text, consent_at, marketing_ok, raw, created_at, updated_at)
    SELECT e.id, bl.id, e.full_name, e.phone, e.email, e.province,
           jsonb_strip_nulls(jsonb_build_object('factura', trim_scale(e.monthly_bill)::text, 'inmueble', e.property_type,
             'propietario', CASE WHEN e.owner IS NULL THEN NULL WHEN e.owner THEN 'si' ELSE 'no' END,
             'compania', e.supplier, 'tipo_cliente', e.customer_type)),
           e.priority, e.priority_reasons,
           CASE e.status WHEN 'estudio_enviado' THEN 'propuesta' WHEN 'contratado' THEN 'ganado' ELSE e.status END,
           e.attempts, e.first_contact_at, e.last_contact_at, e.converted_at, e.commission, e.lost_reason, e.notes,
           e.channel, e.campaign, e.utm, e.consent_text, e.consent_at, e.marketing_ok, e.raw, e.created_at, e.updated_at
      FROM energy_leads e JOIN business_lines bl ON bl.slug = e.vertical
    ON CONFLICT (id) DO NOTHING;
    DROP TABLE energy_leads;
  END IF;
END $$;
