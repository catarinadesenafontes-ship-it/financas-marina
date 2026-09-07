import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { extrairTextoPdf } from '../lib/pdfTexto'
import {
  montarChavesDedup,
  indexarCategorias,
  linhasFaturaParaGastos,
  linhasExtratoParaLancamentos,
} from '../lib/importacao'

const CHAVES_PARA_INVALIDAR = [
  'lancamentos', 'gastos_cartao', 'dashboard', 'dashboard_6m',
  'saldo_cc', 'saldo_mesada', 'mesada_ajuda', 'insights',
  'relatorio_cc', 'relatorio_cartao', 'month_range', 'pendentes',
]

export function useImportacao() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [etapa, setEtapa] = useState('parado') // parado | lendo | interpretando | gravando
  const [erro, setErro] = useState(null)

  /**
   * Lê o PDF sem gravar nada: o arquivo é aberto no navegador e só o texto vai
   * para a leitura. Devolve as linhas para a Marina conferir antes de importar.
   */
  async function lerDocumento({ arquivo, senha, tipo }) {
    setErro(null)
    setEtapa('lendo')
    try {
      const { texto, numPaginas } = await extrairTextoPdf(arquivo, senha)

      setEtapa('interpretando')
      const resposta = await fetch('/api/ler-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, tipo }),
      })

      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(dados.erro ?? 'Não consegui ler o documento.')
      if (!dados.linhas?.length) {
        throw new Error('Não encontrei nenhum lançamento nesse arquivo. Confira se é mesmo a fatura ou o extrato.')
      }

      return { ...dados, numPaginas, arquivoNome: arquivo.name }
    } catch (e) {
      setErro(e.message)
      throw e
    } finally {
      setEtapa('parado')
    }
  }

  /** Índice "estabelecimento → categoria" a partir do que ela já classificou. */
  async function carregarIndiceCategorias(tipo) {
    const tabela = tipo === 'fatura_cartao' ? 'gastos_cartao' : 'lancamentos_cc'
    const { data } = await supabase
      .from(tabela)
      .select('descricao, categoria')
      .eq('user_id', user.id)
      .not('categoria', 'is', null)
      .not('descricao', 'is', null)
      .order('data', { ascending: false })
      .limit(1000)
    return indexarCategorias(data ?? [])
  }

  /**
   * Grava as linhas escolhidas. Duplicata é barrada pelo índice único do banco
   * (ON CONFLICT DO NOTHING), então subir a mesma fatura duas vezes não dobra
   * nada — o retorno diz quantas entraram e quantas já existiam.
   */
  async function importar({ linhas, tipo, banco, contaId, faturaMes, arquivoNome, periodo }) {
    setErro(null)
    setEtapa('gravando')
    try {
      const { data: importacao, error: erroImportacao } = await supabase
        .from('importacoes')
        .insert([{
          user_id: user.id,
          tipo,
          banco: banco ?? null,
          conta_id: contaId ?? null,
          arquivo_nome: arquivoNome ?? null,
          fatura_mes: faturaMes ?? null,
          periodo_inicio: periodo?.inicio ?? null,
          periodo_fim: periodo?.fim ?? null,
          total_lidos: linhas.length,
        }])
        .select()
        .single()
      if (erroImportacao) throw erroImportacao

      const chaves = montarChavesDedup(linhas)
      const tabela = tipo === 'fatura_cartao' ? 'gastos_cartao' : 'lancamentos_cc'

      const registros = linhas.map((linha, i) => ({
        user_id: user.id,
        data: linha.data,
        descricao: linha.descricao || null,
        valor: linha.valor,
        categoria: linha.categoria || null,
        origem: linha.origem ?? 'marina',
        importacao_id: importacao.id,
        dedup_chave: chaves[i],
        revisado: false,
        ...(tipo === 'fatura_cartao'
          ? { fatura_mes: linha.fatura_mes ?? faturaMes }
          : { conta_id: linha.conta_id ?? contaId, tipo: linha.tipo }),
      }))

      const { data: inseridos, error: erroInsert } = await supabase
        .from(tabela)
        .upsert(registros, { onConflict: 'user_id,dedup_chave', ignoreDuplicates: true })
        .select('id')
      if (erroInsert) throw erroInsert

      const importados = inseridos?.length ?? 0
      const duplicados = registros.length - importados

      await supabase
        .from('importacoes')
        .update({ total_importados: importados, total_duplicados: duplicados })
        .eq('id', importacao.id)

      CHAVES_PARA_INVALIDAR.forEach(k => qc.invalidateQueries({ queryKey: [k] }))

      return { importados, duplicados, importacaoId: importacao.id }
    } catch (e) {
      setErro(e.message ?? 'Não consegui gravar os lançamentos.')
      throw e
    } finally {
      setEtapa('parado')
    }
  }

  /** Desfaz uma importação inteira — só remove o que veio dela. */
  async function desfazer({ importacaoId, tipo }) {
    const tabela = tipo === 'fatura_cartao' ? 'gastos_cartao' : 'lancamentos_cc'
    const { error } = await supabase.from(tabela).delete().eq('importacao_id', importacaoId)
    if (error) throw error
    await supabase.from('importacoes').delete().eq('id', importacaoId)
    CHAVES_PARA_INVALIDAR.forEach(k => qc.invalidateQueries({ queryKey: [k] }))
  }

  return {
    etapa,
    erro,
    ocupado: etapa !== 'parado',
    lerDocumento,
    carregarIndiceCategorias,
    importar,
    desfazer,
    linhasFaturaParaGastos,
    linhasExtratoParaLancamentos,
  }
}
