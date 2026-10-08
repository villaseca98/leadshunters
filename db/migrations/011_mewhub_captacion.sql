-- Recorta y MewHub son empresas desde las que se captan clientes, no clientes.
-- 1) MewHub (creación y mantenimiento web) con su línea y su embudo de Instagram.
-- 2) Fuera los "Recorta" que se crearon como clientes; sus leads se quedan en su línea (luz, placas).
-- 3) Cada línea define también los campos de sus clientes; los clientes se dan de alta a mano o al convertir un lead.

ALTER TABLE business_lines ADD COLUMN IF NOT EXISTS client_fields jsonb NOT NULL DEFAULT '[]';
ALTER TABLE line_clients ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}';
ALTER TABLE line_clients ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES line_leads(id) ON DELETE SET NULL;

INSERT INTO companies(slug, name, notes) VALUES ('mewhub', 'MewHub', 'Creación y mantenimiento de webs.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO business_lines(company_id, slug, name, emoji, keywords, fields, priority_a, priority_b, consent_text, thanks_text,
                           proposal_label, won_label, value_label, position)
SELECT id, 'web', 'Webs', '🌐', '{web,pagina web,página web,mewhub,tienda online,mantenimiento web}',
  '[
    {"key":"negocio","label":"¿Qué negocio tienes?","type":"text","aliases":["business","sector","empresa_tipo"]},
    {"key":"tiene_web","label":"¿Tienes web?","type":"select","aliases":["web_actual","has_website"],
     "options":[{"label":"No tengo web","value":"no","points":2},{"label":"Tengo, pero está anticuada","value":"anticuada","points":2},
                {"label":"Tengo y funciona bien","value":"bien","points":-1}]},
    {"key":"servicio","label":"¿Qué necesitas?","type":"select","aliases":["necesidad","service"],
     "options":[{"label":"Web nueva","value":"nueva","points":1},{"label":"Tienda online","value":"tienda","points":2},
                {"label":"Mantenimiento","value":"mantenimiento","points":1},{"label":"Rediseño","value":"rediseno","points":1}]},
    {"key":"presupuesto","label":"Presupuesto","type":"select","aliases":["budget"],
     "options":[{"label":"Menos de 500 €","value":"300","points":-1},{"label":"Entre 500 y 1.500 €","value":"1000","points":1},
                {"label":"Entre 1.500 y 3.000 €","value":"2250","points":2},{"label":"Más de 3.000 €","value":"4000","points":3}]}
  ]'::jsonb, 4, 1,
  'Acepto la política de privacidad y que MewHub me contacte por teléfono, WhatsApp o email para preparar un presupuesto de mi web.',
  'Te llamamos en breve para preparar el presupuesto de tu web. Es gratis y sin compromiso.',
  'Presupuesto enviado', 'Contratado', 'Importe', 30
  FROM companies WHERE slug = 'mewhub'
ON CONFLICT (slug) DO NOTHING;

-- Campos de los clientes de cada línea (se editan en Ajustes › Empresas y líneas)
UPDATE business_lines SET client_fields = '[
  {"key":"comercializadora","label":"Comercializadora contratada","type":"text"},
  {"key":"tarifa","label":"Tarifa","type":"text"},
  {"key":"ahorro_anual","label":"Ahorro anual (€)","type":"number"},
  {"key":"fecha_alta","label":"Fecha de alta","type":"text"}
]'::jsonb WHERE slug = 'luz' AND client_fields = '[]';
UPDATE business_lines SET client_fields = '[
  {"key":"instalador","label":"Instalador","type":"text"},
  {"key":"kwp","label":"Potencia (kWp)","type":"number"},
  {"key":"importe_obra","label":"Importe de la obra (€)","type":"number"},
  {"key":"fecha_instalacion","label":"Fecha de instalación","type":"text"}
]'::jsonb WHERE slug = 'placas' AND client_fields = '[]';
UPDATE business_lines SET client_fields = '[
  {"key":"servicio","label":"Servicio","type":"select","options":[{"label":"Web nueva","value":"nueva"},{"label":"Tienda online","value":"tienda"},{"label":"Mantenimiento","value":"mantenimiento"},{"label":"Web + mantenimiento","value":"web_mantenimiento"}]},
  {"key":"dominio","label":"Dominio","type":"text"},
  {"key":"precio_web","label":"Precio de la web (€)","type":"number"},
  {"key":"entrega","label":"Fecha de entrega","type":"text"},
  {"key":"renovacion","label":"Renovación de dominio y hosting","type":"text"}
]'::jsonb WHERE slug = 'web' AND client_fields = '[]';

-- Recorta no es cliente: se quitan los clientes "Recorta" de las líneas (los leads siguen en luz y placas, sin cliente)
UPDATE line_leads SET client_id = NULL WHERE client_id IN (SELECT id FROM line_clients WHERE name = 'Recorta');
DELETE FROM client_markers WHERE client_kind = 'linea' AND client_id IN (SELECT id FROM line_clients WHERE name = 'Recorta');
DELETE FROM line_clients WHERE name = 'Recorta';

-- …y los dos de arranque de los formularios web (solo si no tienen leads ni oportunidades; si tienen, se quedan para no perder nada).
-- Sin ellos, los formularios recorta-luz y recorta-placas entran como leads de las líneas luz y placas.
DELETE FROM client_markers WHERE client_kind = 'despacho' AND client_id IN (
  SELECT c.id FROM clients c WHERE c.name LIKE 'Recorta · %' AND c.vertical IN ('luz','placas')
     AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.client_id = c.id) AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.client_id = c.id));
DELETE FROM clients c WHERE c.name LIKE 'Recorta · %' AND c.vertical IN ('luz','placas')
   AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.client_id = c.id) AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.client_id = c.id);
