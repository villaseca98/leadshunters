-- Leads Hunters es la MATRIZ y las empresas del grupo cuelgan de ella:
--   Mi Cuenta Nueva (Segunda Oportunidad: particulares con deudas → despachos), Recorta (luz y placas) y MewHub (webs).
-- «Otras ramas» se queda en la propia matriz.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tagline text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '🏢';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 100;
CREATE UNIQUE INDEX IF NOT EXISTS companies_one_parent ON companies (is_parent) WHERE is_parent;

UPDATE companies SET is_parent = true, parent_id = NULL, emoji = '🎯', position = 0,
       tagline = 'Matriz del grupo · CRM privado', notes = 'Matriz. Las empresas del grupo cuelgan de aquí y todos sus leads, clientes e informes se gestionan desde este CRM.'
 WHERE slug = 'leads-hunters';

INSERT INTO companies(slug, name, website, notes, emoji, position, tagline)
VALUES ('micuentanueva', 'Mi Cuenta Nueva', 'https://micuentanueva.vercel.app',
        'Segunda Oportunidad: capta particulares con deudas (test y web) y los pasa a los despachos clientes.', '⚖️', 10,
        'Segunda Oportunidad · particulares y despachos')
ON CONFLICT (slug) DO NOTHING;

UPDATE companies SET emoji = '⚡', position = 20, tagline = coalesce(tagline, 'Luz y placas solares') WHERE slug = 'recorta';
UPDATE companies SET emoji = '🌐', position = 30, tagline = coalesce(tagline, 'Creación y mantenimiento web') WHERE slug = 'mewhub';

-- todas las empresas cuelgan de la matriz
UPDATE companies c SET parent_id = m.id FROM companies m WHERE m.is_parent AND NOT c.is_parent AND c.parent_id IS NULL;

-- la línea de despachos (Segunda Oportunidad) es de Mi Cuenta Nueva
UPDATE business_lines SET company_id = (SELECT id FROM companies WHERE slug = 'micuentanueva'), name = 'Segunda Oportunidad'
 WHERE kind = 'despachos' AND company_id = (SELECT id FROM companies WHERE slug = 'leads-hunters');
