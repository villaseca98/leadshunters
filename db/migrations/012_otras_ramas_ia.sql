-- 1) «Otras ramas»: línea libre para negocios que no estás impulsando todavía pero que ya tienen clientes.
--    Sin preguntas ni palabras clave (no tiene embudo de Instagram): sus clientes se dan de alta a mano.
-- 2) Asistente IA por cliente: conversación, condiciones y plan que monta la IA, e informes mensuales.

INSERT INTO business_lines(company_id, slug, name, emoji, keywords, fields, priority_a, priority_b, consent_text,
                           proposal_label, won_label, value_label, position, client_fields)
SELECT id, 'otras', 'Otras ramas', '🧩', '{}', '[]'::jsonb, 2, 0, '',
  'Propuesta enviada', 'Cerrado', 'Importe', 200,
  '[{"key":"negocio","label":"Negocio o rama","type":"text"},
    {"key":"servicio","label":"Qué le haces","type":"text"},
    {"key":"como_cobras","label":"Cómo te paga","type":"text"}]'::jsonb
  FROM companies WHERE slug = 'leads-hunters'
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS client_ai (
  client_kind  text NOT NULL CHECK (client_kind IN ('despacho','linea')),
  client_id    uuid NOT NULL,
  messages     jsonb NOT NULL DEFAULT '[]',   -- [{role:"user"|"assistant", text, at}]
  plan         jsonb,                         -- {resumen, metricas, pasos, objetivos}
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_kind, client_id)
);

CREATE TABLE IF NOT EXISTS client_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_kind  text NOT NULL CHECK (client_kind IN ('despacho','linea')),
  client_id    uuid NOT NULL,
  month        text NOT NULL,                 -- YYYY-MM
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_kind, client_id, month)
);
