-- Clientes de todas las líneas y marcadores editables por cliente y mes.
-- Despachos sigue con su tabla clients; las demás líneas (luz, placas…) tienen sus clientes en line_clients
-- (por ejemplo Recorta, una comercializadora o un instalador que te paga).

CREATE TABLE IF NOT EXISTS line_clients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id           uuid NOT NULL REFERENCES business_lines(id) ON DELETE CASCADE,
  name              text NOT NULL,
  contact_name      text,
  contact_phone     text,
  contact_email     text,
  status            text NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','pausado','baja')),
  monthly_fee       numeric(10,2) NOT NULL DEFAULT 0,  -- fijo al mes
  price_per_showup  numeric(10,2) NOT NULL DEFAULT 0,  -- por cita o visita a la que se presenta el lead
  price_per_sale    numeric(10,2) NOT NULL DEFAULT 0,  -- por venta, si en el lead no pones otro importe
  notes             text,
  started_at        date NOT NULL DEFAULT current_date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE line_leads ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES line_clients(id) ON DELETE SET NULL;
ALTER TABLE line_leads ADD COLUMN IF NOT EXISTS showup_at timestamptz;   -- se presentó a la cita o visita
CREATE INDEX IF NOT EXISTS line_leads_client_idx ON line_leads(client_id, created_at);

-- Marcadores: contadores e importes que añades a mano a un cliente en un mes (ventas, comisiones, bonus…)
CREATE TABLE IF NOT EXISTS client_markers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_kind  text NOT NULL CHECK (client_kind IN ('despacho','linea')),
  client_id    uuid NOT NULL,
  month        text NOT NULL,              -- YYYY-MM
  label        text NOT NULL,
  unit         text NOT NULL DEFAULT 'num' CHECK (unit IN ('num','eur')),
  billable     boolean NOT NULL DEFAULT false,  -- un importe que se suma a lo que le facturas
  value        numeric(12,2) NOT NULL DEFAULT 0,
  position     integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_kind, client_id, month, label)
);
CREATE INDEX IF NOT EXISTS client_markers_client_idx ON client_markers(client_kind, client_id, month);

-- Recorta como primer cliente de luz y de placas (cobra por comisión de cada contrato)
INSERT INTO line_clients(line_id, name, notes)
SELECT bl.id, 'Recorta', 'Comisión por contrato: pon el importe al cerrar cada lead.'
  FROM business_lines bl WHERE bl.slug IN ('luz','placas')
   AND NOT EXISTS (SELECT 1 FROM line_clients lc WHERE lc.line_id = bl.id);
UPDATE line_leads ll SET client_id = lc.id FROM line_clients lc WHERE lc.line_id = ll.line_id AND ll.client_id IS NULL;
