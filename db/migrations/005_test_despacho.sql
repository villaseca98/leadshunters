-- Enlace del test con el nombre de cada despacho (/test/<codigo>) para anunciarse desde su página de Facebook.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS test_code text UNIQUE DEFAULT encode(gen_random_bytes(5), 'hex');
