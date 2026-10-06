-- Auditoría pública de cada despacho prospecto: enlace propio y registro de visitas
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS audit_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS audit_views integer NOT NULL DEFAULT 0;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS audit_last_view_at timestamptz;
