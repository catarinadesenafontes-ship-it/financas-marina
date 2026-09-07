-- ============================================================
-- Migration 4 — direção explícita das transferências
--
-- Problema: a direção de uma transferência era inferida a partir de
-- transferencia_par_id. Como as duas pernas do par apontam uma para a outra,
-- o teste dava "entrada" para as DUAS — a saída da conta de origem era contada
-- como crédito, inflando o saldo.
--
-- Solução: gravar a direção na própria linha.
-- ============================================================

ALTER TABLE lancamentos_cc
  ADD COLUMN IF NOT EXISTS direcao TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lancamentos_cc_direcao_check'
  ) THEN
    ALTER TABLE lancamentos_cc
      ADD CONSTRAINT lancamentos_cc_direcao_check
      CHECK (direcao IS NULL OR direcao IN ('entrada', 'saida'));
  END IF;
END $$;

-- Backfill das transferências já existentes.
-- criarTransferencia() sempre insere a perna de SAÍDA primeiro e a de ENTRADA
-- depois, então dentro de cada par o created_at menor é a saída.
-- (id como desempate para garantir exatamente uma saída e uma entrada por par.)
UPDATE lancamentos_cc AS l
SET direcao = CASE
  WHEN l.created_at < p.created_at THEN 'saida'
  WHEN l.created_at > p.created_at THEN 'entrada'
  WHEN l.id < p.id THEN 'saida'
  ELSE 'entrada'
END
FROM lancamentos_cc AS p
WHERE l.tipo = 'transferencia'
  AND l.direcao IS NULL
  AND p.id = l.transferencia_par_id;

-- Transferências órfãs (sem par gravado): tratadas como saída.
UPDATE lancamentos_cc
SET direcao = 'saida'
WHERE tipo = 'transferencia' AND direcao IS NULL;

-- ============================================================
-- Conferência (opcional): todo par deve ter uma saída e uma entrada.
-- O resultado esperado é ZERO linhas.
--
--   SELECT l.id, l.direcao, p.direcao AS direcao_par
--   FROM lancamentos_cc l
--   JOIN lancamentos_cc p ON p.id = l.transferencia_par_id
--   WHERE l.tipo = 'transferencia' AND l.direcao = p.direcao;
-- ============================================================
