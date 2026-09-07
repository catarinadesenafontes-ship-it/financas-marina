-- ============================================================
-- Migration 5 — descrição opcional
--
-- A Marina identifica quase todo lançamento pela categoria. Exigir descrição
-- só atrasa o registro, então o campo passa a ser opcional; quando vem vazio,
-- a categoria vira o rótulo do lançamento nas listas.
-- ============================================================

ALTER TABLE lancamentos_cc ALTER COLUMN descricao DROP NOT NULL;
ALTER TABLE gastos_cartao  ALTER COLUMN descricao DROP NOT NULL;

-- Descrições vazias já gravadas viram NULL, para não existirem dois jeitos de
-- dizer "sem descrição".
UPDATE lancamentos_cc SET descricao = NULL WHERE btrim(descricao) = '';
UPDATE gastos_cartao  SET descricao = NULL WHERE btrim(descricao) = '';
