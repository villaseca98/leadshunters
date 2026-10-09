-- Conceptos operativos según la naturaleza de cada línea:
-- 1) Ficha operativa de los leads (CUPS y potencia en luz, tejado y orientación en placas, web actual y plazo en webs…).
-- 2) Auditoría mensual de cada cliente: una lista de comprobación propia de cada línea, con su nota (%).

ALTER TABLE business_lines ADD COLUMN IF NOT EXISTS lead_fields jsonb NOT NULL DEFAULT '[]';
ALTER TABLE business_lines ADD COLUMN IF NOT EXISTS audit_items jsonb NOT NULL DEFAULT '[]';
ALTER TABLE line_leads ADD COLUMN IF NOT EXISTS ops jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS client_audits (
  client_kind  text NOT NULL CHECK (client_kind IN ('despacho','linea')),
  client_id    uuid NOT NULL,
  month        text NOT NULL,                 -- YYYY-MM
  item_key     text NOT NULL,
  done         boolean NOT NULL DEFAULT false,
  note         text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_kind, client_id, month, item_key)
);

UPDATE business_lines SET lead_fields = '[
  {"key":"cups","label":"CUPS","type":"text"},
  {"key":"tarifa_acceso","label":"Tarifa de acceso","type":"select","options":[{"label":"2.0TD (hasta 15 kW)","value":"2.0TD"},{"label":"3.0TD","value":"3.0TD"},{"label":"6.1TD","value":"6.1TD"}]},
  {"key":"potencia_kw","label":"Potencia contratada (kW)","type":"number"},
  {"key":"consumo_anual_kwh","label":"Consumo anual (kWh)","type":"number"},
  {"key":"comercializadora_actual","label":"Comercializadora actual","type":"text"},
  {"key":"fin_contrato","label":"Fin de su contrato actual","type":"text"}
]'::jsonb, audit_items = '[
  {"key":"facturas","label":"Facturas de los leads recibidas","area":"captación"},
  {"key":"comparativas","label":"Comparativas enviadas en 24 h","area":"atención"},
  {"key":"contratos","label":"Contratos firmados y subidos","area":"cierre"},
  {"key":"altas","label":"Altas activadas por la comercializadora","area":"cierre"},
  {"key":"comisiones","label":"Comisiones liquidadas","area":"cobro"},
  {"key":"informe","label":"Informe del mes enviado","area":"seguimiento"}
]'::jsonb WHERE slug = 'luz' AND lead_fields = '[]';

UPDATE business_lines SET lead_fields = '[
  {"key":"tipo_tejado","label":"Tipo de tejado","type":"select","options":[{"label":"Teja","value":"teja"},{"label":"Chapa","value":"chapa"},{"label":"Plano / terraza","value":"plano"},{"label":"Suelo","value":"suelo"}]},
  {"key":"orientacion","label":"Orientación","type":"select","options":[{"label":"Sur","value":"sur"},{"label":"Este-oeste","value":"este_oeste"},{"label":"Norte","value":"norte"}]},
  {"key":"superficie_m2","label":"Superficie útil (m²)","type":"number"},
  {"key":"consumo_anual_kwh","label":"Consumo anual (kWh)","type":"number"},
  {"key":"bateria","label":"Quiere batería","type":"select","options":[{"label":"Sí","value":"si"},{"label":"No","value":"no"},{"label":"No sabe","value":"ns"}]},
  {"key":"visita_tecnica","label":"Visita técnica (fecha)","type":"text"}
]'::jsonb, audit_items = '[
  {"key":"visitas","label":"Visitas técnicas hechas en 7 días","area":"atención"},
  {"key":"presupuestos","label":"Presupuestos enviados","area":"atención"},
  {"key":"firmas","label":"Obras firmadas","area":"cierre"},
  {"key":"instalaciones","label":"Instalaciones terminadas","area":"entrega"},
  {"key":"legalizacion","label":"Legalización y subvenciones tramitadas","area":"entrega"},
  {"key":"comision","label":"Comisión cobrada","area":"cobro"}
]'::jsonb WHERE slug = 'placas' AND lead_fields = '[]';

UPDATE business_lines SET lead_fields = '[
  {"key":"web_actual","label":"Web actual (dirección)","type":"text"},
  {"key":"sector","label":"Sector","type":"text"},
  {"key":"paginas","label":"Páginas que necesita","type":"number"},
  {"key":"plazo","label":"Plazo","type":"select","options":[{"label":"Urgente (menos de 2 semanas)","value":"urgente"},{"label":"Este mes","value":"mes"},{"label":"Sin prisa","value":"sin_prisa"}]},
  {"key":"referencias","label":"Webs que le gustan","type":"text"}
]'::jsonb, audit_items = '[
  {"key":"briefing","label":"Briefing y contenidos recibidos","area":"arranque"},
  {"key":"diseno","label":"Diseño aprobado","area":"entrega"},
  {"key":"publicada","label":"Web publicada y revisada en móvil","area":"entrega"},
  {"key":"dominio","label":"Dominio y hosting al día","area":"mantenimiento"},
  {"key":"mantenimiento","label":"Mantenimiento del mes hecho (actualizaciones y copia)","area":"mantenimiento"},
  {"key":"cobro","label":"Factura del mes cobrada","area":"cobro"}
]'::jsonb WHERE slug = 'web' AND lead_fields = '[]';

UPDATE business_lines SET lead_fields = '[
  {"key":"necesidad","label":"Qué necesita","type":"text"},
  {"key":"presupuesto","label":"Presupuesto (€)","type":"number"}
]'::jsonb, audit_items = '[
  {"key":"objetivos","label":"Objetivos del mes revisados con el cliente","area":"seguimiento"},
  {"key":"entregables","label":"Entregables del mes hechos","area":"entrega"},
  {"key":"informe","label":"Informe del mes enviado","area":"seguimiento"},
  {"key":"cobro","label":"Factura del mes cobrada","area":"cobro"}
]'::jsonb WHERE slug = 'otras' AND lead_fields = '[]';

-- despachos (Segunda Oportunidad): solo la auditoría; sus leads ya tienen su cualificación de deudas
UPDATE business_lines SET audit_items = '[
  {"key":"llamada_5min","label":"Llama a los leads en menos de 5 minutos","area":"atención"},
  {"key":"agenda","label":"Agenda abierta para consultas esta semana","area":"atención"},
  {"key":"confirma","label":"Confirma las consultas realizadas en su panel","area":"cierre"},
  {"key":"resenas","label":"Pide reseñas en Google a los clientes","area":"reputación"},
  {"key":"anuncios","label":"Anuncios activos y con saldo","area":"captación"},
  {"key":"informe","label":"Informe del mes enviado","area":"seguimiento"},
  {"key":"cobro","label":"Factura del mes cobrada","area":"cobro"}
]'::jsonb WHERE kind = 'despachos' AND audit_items = '[]';
