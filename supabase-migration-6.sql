-- ============================================================
-- Migration 6 — importação de fatura e extrato em PDF
--
-- Em vez de lançar compra por compra, a Marina sobe o PDF da fatura e o
-- sistema cria os lançamentos. Ela só ajusta categoria e origem depois.
--
-- Duas coisas precisam existir para isso não virar bagunça:
--   • rastro da importação, para saber de onde veio cada lançamento e poder
--     desfazer uma importação inteira;
--   • trava de duplicata, porque ela vai subir a mesma fatura mais de uma vez
--     ao longo do mês.
-- ============================================================

CREATE TABLE IF NOT EXISTS importacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('fatura_cartao', 'extrato_cc')) NOT NULL,
  banco TEXT,
  conta_id UUID REFERENCES contas(id) ON DELETE SET NULL,
  arquivo_nome TEXT,
  fatura_mes TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  total_lidos INTEGER DEFAULT 0,
  total_importados INTEGER DEFAULT 0,
  total_duplicados INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE importacoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'importacoes' AND policyname = 'importacoes_select') THEN
    CREATE POLICY "importacoes_select" ON importacoes FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY "importacoes_insert" ON importacoes FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY "importacoes_update" ON importacoes FOR UPDATE USING (user_id = auth.uid());
    CREATE POLICY "importacoes_delete" ON importacoes FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ------------------------------------------------------------
-- Rastro e trava nos lançamentos
--
-- dedup_chave identifica a linha dentro do documento:
--   data|valor|descrição normalizada|ocorrência
-- A ocorrência existe porque dois Ubers iguais no mesmo dia são dois gastos
-- de verdade — sem ela, o segundo seria descartado como duplicata.
--
-- revisado = false marca o que veio de importação e ainda espera categoria e
-- origem. Tudo que já existe foi lançado à mão, então já nasce revisado.
-- ------------------------------------------------------------

ALTER TABLE gastos_cartao
  ADD COLUMN IF NOT EXISTS importacao_id UUID REFERENCES importacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dedup_chave TEXT,
  ADD COLUMN IF NOT EXISTS revisado BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE lancamentos_cc
  ADD COLUMN IF NOT EXISTS importacao_id UUID REFERENCES importacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dedup_chave TEXT,
  ADD COLUMN IF NOT EXISTS revisado BOOLEAN NOT NULL DEFAULT true;

-- A trava é no banco, não só no app: mesmo que a tela erre, o Postgres recusa
-- a segunda cópia.
--
-- O índice é total, não parcial, de propósito: ON CONFLICT só enxerga índice
-- parcial se a instrução repetir o mesmo WHERE, e o cliente não gera isso. Como
-- NULL nunca conflita com NULL em índice único, os lançamentos manuais (que não
-- têm chave) continuam livres do mesmo jeito.
CREATE UNIQUE INDEX IF NOT EXISTS gastos_cartao_dedup
  ON gastos_cartao (user_id, dedup_chave);

CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_cc_dedup
  ON lancamentos_cc (user_id, dedup_chave);

-- Buscar o que falta revisar é a consulta mais frequente da tela nova.
CREATE INDEX IF NOT EXISTS gastos_cartao_revisado
  ON gastos_cartao (user_id, revisado) WHERE revisado = false;

CREATE INDEX IF NOT EXISTS lancamentos_cc_revisado
  ON lancamentos_cc (user_id, revisado) WHERE revisado = false;
