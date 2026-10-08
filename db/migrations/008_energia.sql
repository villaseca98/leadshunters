-- Líneas de negocio de energía (marca Recorta): luz de negocios y placas solares.
-- Los despachos (LSO) siguen igual. Un cliente de luz es la comercializadora o tu cuenta de agente;
-- uno de placas es el instalador. Cada uno cobra distinto: no hay citas, hay oportunidades.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS vertical text NOT NULL DEFAULT 'lso';
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_vertical_check;
ALTER TABLE clients ADD CONSTRAINT clients_vertical_check CHECK (vertical IN ('lso','luz','placas'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand text;                       -- marca con la que se llama (Recorta). Vacío = nombre del cliente
ALTER TABLE clients ADD COLUMN IF NOT EXISTS web_form_ids text[] NOT NULL DEFAULT '{}'; -- formularios web propios (recorta-luz, recorta-placas…)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS price_per_lead numeric(10,2);      -- placas: por lead aceptado por el instalador
ALTER TABLE clients ADD COLUMN IF NOT EXISTS price_per_sale numeric(10,2);      -- luz: por contrato activado · placas: fijo por obra firmada
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sale_commission_pct numeric(5,2);  -- placas: % sobre el importe de la obra firmada
ALTER TABLE clients ADD COLUMN IF NOT EXISTS min_monthly_bill numeric(10,2);    -- factura mínima que le interesa (€/mes)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS accept_hours integer NOT NULL DEFAULT 72; -- horas que tiene el socio para rechazar un lead

-- Datos de energía del lead
ALTER TABLE leads ADD COLUMN IF NOT EXISTS vertical text NOT NULL DEFAULT 'lso';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interest text;               -- luz | placas | luz+placas
ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_type text;          -- bar, taller, comunidad…
ALTER TABLE leads ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS monthly_bill numeric(10,2);  -- €/mes de luz
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tariff text;                 -- 2.0TD | 3.0TD | 6.1TD
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contracted_power_kw numeric(7,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_supplier text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS roof text;                   -- propio | comunidad | alquiler | no
ALTER TABLE leads ADD COLUMN IF NOT EXISTS daytime_share integer;       -- % del consumo en horas de sol
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_saving numeric(10,2); -- ahorro anual que le calculó la web
ALTER TABLE leads ADD COLUMN IF NOT EXISTS summary text;                -- resumen del análisis de la web
CREATE INDEX IF NOT EXISTS leads_vertical_idx ON leads(vertical, created_at DESC);

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN
  ('nuevo','en_llamada','no_contesta','volver_a_llamar','contactado','cita_agendada','oportunidad','no_cualificado','descartado','duplicado'));
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_outcome_check;
ALTER TABLE calls ADD CONSTRAINT calls_outcome_check CHECK (outcome IN
  ('no_contesta','buzon','numero_erroneo','volver_a_llamar','no_cualificado','no_interesado','cita_agendada','oportunidad'));

-- Oportunidades: lo que pasa con el lead después de la llamada.
--   luz:    estudio → oferta_enviada → firmado → activado (se cobra) | perdido
--   placas: enviado → aceptado (se cobra el lead) | rechazado → visita → presupuesto → firmado (comisión) | perdido
CREATE TABLE IF NOT EXISTS deals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vertical            text NOT NULL CHECK (vertical IN ('luz','placas')),
  stage               text NOT NULL CHECK (stage IN
                        ('estudio','oferta_enviada','firmado','activado','perdido','enviado','aceptado','rechazado','visita','presupuesto')),
  offer_supplier      text,            -- luz: comercializadora de la oferta
  offer_annual_saving numeric(10,2),   -- luz: ahorro anual de la oferta
  visit_at            timestamptz,     -- placas
  budget_amount       numeric(12,2),   -- placas: importe del presupuesto
  kwp                 numeric(7,2),    -- placas
  signed_amount       numeric(12,2),   -- placas: importe de la obra firmada
  accepted_at         timestamptz,     -- placas: lead aceptado (facturable)
  accepted_by         text,            -- socio | equipo | automatico
  rejected_reason     text,
  signed_at           timestamptz,
  activated_at        timestamptz,     -- luz: suministro activado (facturable)
  lost_reason         text,
  partner_token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'), -- enlace del socio
  partner_notified_at timestamptz,
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, client_id)
);
CREATE INDEX IF NOT EXISTS deals_client_idx ON deals(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals(vertical, stage);

-- Historial de cambios de etapa (justificante para facturar)
CREATE TABLE IF NOT EXISTS deal_events (
  id         bigserial PRIMARY KEY,
  deal_id    uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  stage      text NOT NULL,
  by_who     text NOT NULL,            -- equipo | socio | automatico
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_events_deal_idx ON deal_events(deal_id, created_at);

-- Clientes de arranque para que los leads de la web de Recorta no se pierdan.
-- Cámbiales el nombre, el email de avisos y los precios en Clientes cuando tengas el acuerdo firmado.
INSERT INTO clients(name, plan, vertical, brand, web_form_ids, monthly_fee, price_per_consultation, price_per_sale, min_monthly_bill, notes)
SELECT 'Recorta · Luz (mi cuenta de agente)', 'personalizado', 'luz', 'Recorta', '{recorta-luz}', 0, 0, 60, 60,
       'Leads de luz de la web de Recorta. Precio por contrato activado orientativo: pon la comisión real de tu comercializadora.'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE 'recorta-luz' = ANY(web_form_ids));
INSERT INTO clients(name, plan, vertical, brand, web_form_ids, monthly_fee, price_per_consultation, price_per_lead, sale_commission_pct, min_monthly_bill, notes)
SELECT 'Recorta · Placas (instalador por asignar)', 'personalizado', 'placas', 'Recorta', '{recorta-placas}', 0, 0, 35, 3, 80,
       'Leads de placas de la web de Recorta. Precio por lead aceptado y % de obra orientativos: pon los de tu acuerdo con el instalador.'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE 'recorta-placas' = ANY(web_form_ids));
