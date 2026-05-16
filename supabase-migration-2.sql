-- Migration 2: Add melhor_dia_compra to configuracao_cartao
ALTER TABLE configuracao_cartao
  ADD COLUMN IF NOT EXISTS melhor_dia_compra INTEGER DEFAULT 19;
