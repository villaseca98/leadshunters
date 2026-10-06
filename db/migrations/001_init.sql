-- Leads Hunters: esquema inicial
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Usuarios del panel (admin y telefonistas)
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'caller' CHECK (role IN ('admin','caller')),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============ PARTE 1: PROSPECCIÓN B2B (despachos a los que vendemos) ============
CREATE TABLE prospects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id         text UNIQUE,              -- id de Google Maps (dedupe)
  name             text NOT NULL,
  category         text,
  address          text,
  city             text,
  province         text,
  postal_code      text,
  phone            text,
  email            text,
  website          text,
  google_maps_url  text,
  rating           numeric(2,1),
  reviews_count    integer,
  instagram        text,
  facebook         text,
  linkedin         text,
  tiktok           text,
  youtube          text,
  instagram_followers      integer,
  instagram_days_since_post integer,
  website_mentions_lso boolean,              -- la web habla de Segunda Oportunidad
  website_has_form     boolean,
  website_has_whatsapp boolean,
  website_has_pixel    boolean,              -- pixel de Meta / tag de Google Ads
  meta_ads_active      boolean,
  meta_ads_count       integer,
  meta_ads_lso         boolean,              -- sus anuncios hablan de deudas/LSO
  meta_ads_checked_at  timestamptz,
  enriched_at      timestamptz,
  score            integer NOT NULL DEFAULT 0,
  score_tier       text NOT NULL DEFAULT 'C',
  score_breakdown  jsonb NOT NULL DEFAULT '[]',
  call_hooks       jsonb NOT NULL DEFAULT '[]',   -- ganchos para abrir la llamada
  status           text NOT NULL DEFAULT 'nuevo'
                   CHECK (status IN ('nuevo','a_llamar','no_contesta','contactado','interesado','reunion','propuesta','cliente','descartado')),
  next_action_at   timestamptz,
  owner_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  notes            text,
  source           text NOT NULL DEFAULT 'manual',
  search_term      text,
  raw              jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prospects_status_idx ON prospects(status);
CREATE INDEX prospects_score_idx ON prospects(score DESC);
CREATE INDEX prospects_city_idx ON prospects(lower(city));
CREATE UNIQUE INDEX prospects_name_phone_uq ON prospects(lower(name), coalesce(phone,'')) WHERE place_id IS NULL;

CREATE TABLE prospect_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  kind        text NOT NULL CHECK (kind IN ('llamada','email','whatsapp','reunion','nota','estado')),
  outcome     text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prospect_activities_prospect_idx ON prospect_activities(prospect_id, created_at DESC);

-- ============ PARTE 2: CLIENTES (despachos que nos pagan) Y SUS LEADS ============
CREATE TABLE clients (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id              uuid REFERENCES prospects(id) ON DELETE SET NULL,
  name                     text NOT NULL,
  contact_name             text,
  contact_phone            text,
  contact_email            text,
  notify_email             text,               -- a dónde mandamos las citas
  city                     text,
  provinces                text[] NOT NULL DEFAULT '{}', -- zonas que atiende (vacío = toda España)
  status                   text NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','pausado','baja')),
  monthly_fee              numeric(10,2) NOT NULL DEFAULT 500,
  price_per_consultation   numeric(10,2) NOT NULL DEFAULT 40,  -- 30-50 €: honorario de marketing por consulta realizada
  max_billable_per_month   integer,            -- tope de consultas facturables (opcional)
  min_debt                 numeric(12,2) NOT NULL DEFAULT 8000,
  min_creditors            integer NOT NULL DEFAULT 2,
  calendar_url             text,               -- Calendly / Google Calendar del despacho
  meta_form_ids            text[] NOT NULL DEFAULT '{}', -- formularios de Meta Lead Ads de este cliente
  google_form_ids          text[] NOT NULL DEFAULT '{}', -- form_id / campaign_id de Google Ads
  api_key                  text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  started_at               date NOT NULL DEFAULT current_date,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source                text NOT NULL DEFAULT 'manual' CHECK (source IN ('meta','google','web','manual','otro')),
  external_id           text,                 -- leadgen_id de Meta / lead_id de Google
  campaign              text,
  ad_name               text,
  full_name             text NOT NULL,
  phone                 text,
  email                 text,
  province              text,
  debt_amount           numeric(12,2),
  creditors_count       integer,
  monthly_income        numeric(10,2),
  employment_status     text,                 -- asalariado, autonomo, desempleado, pensionista, otro
  owns_home             boolean,
  prior_lso             boolean,              -- ya usó la LSO en los últimos 5 años
  criminal_record       boolean,              -- condenas por delitos económicos
  consent_at            timestamptz,
  consent_text          text,
  qualification_score   integer NOT NULL DEFAULT 0,
  qualification_status  text NOT NULL DEFAULT 'pendiente' CHECK (qualification_status IN ('cualificado','dudoso','no_cualificado','pendiente')),
  qualification_reasons jsonb NOT NULL DEFAULT '[]',
  status                text NOT NULL DEFAULT 'nuevo'
                        CHECK (status IN ('nuevo','en_llamada','no_contesta','volver_a_llamar','contactado','cita_agendada','no_cualificado','descartado','duplicado')),
  attempts              integer NOT NULL DEFAULT 0,
  next_call_at          timestamptz NOT NULL DEFAULT now(),
  first_contact_at      timestamptz,
  last_called_at        timestamptz,
  locked_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  locked_at             timestamptz,
  notes                 text,
  raw                   jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX leads_external_uq ON leads(client_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX leads_queue_idx ON leads(status, next_call_at);
CREATE INDEX leads_client_idx ON leads(client_id, created_at DESC);
CREATE INDEX leads_phone_idx ON leads(phone);

CREATE TABLE calls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  outcome     text NOT NULL CHECK (outcome IN ('no_contesta','buzon','numero_erroneo','volver_a_llamar','no_cualificado','no_interesado','cita_agendada')),
  notes       text,
  duration_s  integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calls_lead_idx ON calls(lead_id, created_at DESC);

CREATE TABLE consultations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  scheduled_at  timestamptz NOT NULL,
  mode          text NOT NULL DEFAULT 'telefono' CHECK (mode IN ('telefono','videollamada','presencial')),
  status        text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','asistida','no_asistio','cancelada','reprogramada')),
  billable      boolean NOT NULL DEFAULT false,  -- se marca al confirmar asistencia
  confirm_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'), -- enlace para que el despacho confirme asistencia
  confirmed_by  text,                             -- 'equipo' o 'despacho'
  client_notified_at timestamptz,
  reminder_sent_at   timestamptz,
  notes         text,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consultations_client_idx ON consultations(client_id, scheduled_at);

-- Eventos para n8n (outbox): la app los escribe, n8n los consume vía API
CREATE TABLE events (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,      -- lead.nuevo, cita.agendada, cita.asistida...
  payload     jsonb NOT NULL,
  delivered_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_pending_idx ON events(id) WHERE delivered_at IS NULL;

-- Registro RGPD de supresiones
CREATE TABLE gdpr_log (
  id          bigserial PRIMARY KEY,
  action      text NOT NULL,
  subject     text NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
