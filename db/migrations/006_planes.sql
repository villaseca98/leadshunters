-- Plan contratado por cada despacho (fija cuota y precio por consulta salvo 'personalizado').
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'esencial'
  CHECK (plan IN ('esencial','completo','premium','personalizado'));
