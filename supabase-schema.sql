-- ============================================================
-- Finanças Marina — Schema Supabase
-- Execute no SQL Editor do projeto Supabase
-- ============================================================

-- Contas-correntes
CREATE TABLE IF NOT EXISTS contas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lançamentos de conta-corrente
CREATE TABLE IF NOT EXISTS lancamentos_cc (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_id UUID REFERENCES contas(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('entrada', 'saida', 'transferencia')) NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  categoria TEXT,
  transferencia_par_id UUID REFERENCES lancamentos_cc(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gastos no cartão de crédito
CREATE TABLE IF NOT EXISTS gastos_cartao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  categoria TEXT,
  fatura_mes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Configuração do cartão por usuário
CREATE TABLE IF NOT EXISTS configuracao_cartao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  limite NUMERIC(10,2) DEFAULT 0,
  dia_fechamento INTEGER DEFAULT 1,
  dia_vencimento INTEGER DEFAULT 10
);

-- Recebimentos de mesada
CREATE TABLE IF NOT EXISTS mesada (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  origem TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  mes_referencia TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gastos da mesada
CREATE TABLE IF NOT EXISTS gastos_mesada (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  mes_referencia TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_cc ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_cartao ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracao_cartao ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesada ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_mesada ENABLE ROW LEVEL SECURITY;

-- contas
CREATE POLICY "contas_select" ON contas FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "contas_insert" ON contas FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "contas_update" ON contas FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "contas_delete" ON contas FOR DELETE USING (user_id = auth.uid());

-- lancamentos_cc
CREATE POLICY "lancamentos_select" ON lancamentos_cc FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lancamentos_insert" ON lancamentos_cc FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "lancamentos_update" ON lancamentos_cc FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "lancamentos_delete" ON lancamentos_cc FOR DELETE USING (user_id = auth.uid());

-- gastos_cartao
CREATE POLICY "gastos_cartao_select" ON gastos_cartao FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "gastos_cartao_insert" ON gastos_cartao FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "gastos_cartao_update" ON gastos_cartao FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "gastos_cartao_delete" ON gastos_cartao FOR DELETE USING (user_id = auth.uid());

-- configuracao_cartao
CREATE POLICY "config_cartao_select" ON configuracao_cartao FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "config_cartao_insert" ON configuracao_cartao FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "config_cartao_update" ON configuracao_cartao FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "config_cartao_delete" ON configuracao_cartao FOR DELETE USING (user_id = auth.uid());

-- mesada
CREATE POLICY "mesada_select" ON mesada FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "mesada_insert" ON mesada FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "mesada_update" ON mesada FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "mesada_delete" ON mesada FOR DELETE USING (user_id = auth.uid());

-- gastos_mesada
CREATE POLICY "gastos_mesada_select" ON gastos_mesada FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "gastos_mesada_insert" ON gastos_mesada FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "gastos_mesada_update" ON gastos_mesada FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "gastos_mesada_delete" ON gastos_mesada FOR DELETE USING (user_id = auth.uid());
