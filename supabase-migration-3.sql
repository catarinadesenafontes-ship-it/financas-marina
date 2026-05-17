-- Migration 3: Add origem column to lancamentos_cc and gastos_cartao
ALTER TABLE lancamentos_cc ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'marina';
ALTER TABLE gastos_cartao ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'marina';
