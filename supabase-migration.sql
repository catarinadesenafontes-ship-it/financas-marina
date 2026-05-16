-- ============================================================
-- Finanças Marina — Migration v2
-- Execute no SQL Editor do Supabase após o schema inicial
-- ============================================================

-- Adiciona forma_pagamento aos lançamentos de CC
ALTER TABLE lancamentos_cc
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- Adiciona banco vinculado à configuração do cartão
ALTER TABLE configuracao_cartao
  ADD COLUMN IF NOT EXISTS banco TEXT DEFAULT 'Itaú';
