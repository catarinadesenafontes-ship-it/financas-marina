import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { extrairTextoPdf } from '../lib/pdfTexto'
import { lerExtratoCsv, lerArquivoTexto, linhasExtratoCsvParaLancamentos } from '../lib/extratoCsv'
import {
  montarChavesDedup,
  indexarCategorias,
  sugerirCategoria,
  linhasFaturaParaGastos,
  casarTransferenciasProprias,
} from '../lib/importacao'

const CHAVES_PARA_INVALIDAR = [
  'lancamentos', 'gastos_cartao', 'dashboard', 'dashboard_6m',
  'saldo_cc', 'saldo_mesada', 'mesada_ajuda', 'insights',
  'relatorio_cc', 'relatorio_cartao', 'month_range',
]

const LOTE = 200 // insere em blocos: 344 linhas numa tacada só é pedir problema

export function useImportacao() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [etapa, setEtapa] = useState('parado') // parado | lendo | interpretando | gravando
  const [erro, setErro] = useState(null)

  function invalidarTudo() {
    CHAVES_PARA_INVALIDAR.forEach(k => qc.invalidateQueries({ queryKey: [k] }))
  }

  /** Índice "estabelecimento → categoria" a partir do que ela já classificou. */
  async function carregarIndiceCategorias(tabela = 'lancamentos_cc') {
    const { data } = await supabase
      .from(tabela)
      .select('descricao, categoria')
      .eq('user_id', user.id)
      .not('categoria', 'is', null)
      .not('descricao', 'is', null)
      .order('data', { ascending: false })
      .limit(2000)
    return indexarCategorias(data ?? [])
  }

  // ---------------------------------------------------------------- extrato CSV

  /**
   * Lê o extrato em CSV. Não passa por IA: os valores já vêm separados, e a
   * coluna de saldo do próprio arquivo prova que a leitura ficou completa.
   */
  async function lerExtrato({ arquivo, contaId, nomeTitular }) {
    setErro(null)
    setEtapa('lendo')
    try {
      const indice = await carregarIndiceCategorias('lancamentos_cc')
      const conteudo = await lerArquivoTexto(arquivo)
      const extrato = lerExtratoCsv(conteudo)

      const lancamentos = linhasExtratoCsvParaLancamentos(extrato.linhas, {
        contaId,
        indiceCategorias: indice,
        nomeTitular,
        sugerirCategoria,
      })

      // Quantos lançamentos manuais serão substituídos, para ela saber antes.
      const { count } = await supabase
        .from('lancamentos_cc')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('conta_id', contaId)
        .gte('data', extrato.periodo.inicio)
        .lte('data', extrato.periodo.fim)
        .neq('tipo', 'transferencia')

      // Já existe algum lançamento antes do período? Se não, o saldo de partida
      // do extrato precisa ser registrado, senão o app começa do zero e o saldo
      // fica errado por esse valor para sempre.
      const { count: anteriores } = await supabase
        .from('lancamentos_cc')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('conta_id', contaId)
        .lt('data', extrato.periodo.inicio)

      // Transferência que aparece no extrato mas nunca foi lançada deixa o
      // saldo fechar errado — e sem apontar qual é, ninguém descobre por quê.
      // A folga de dias existe porque ela lança a transferência de memória.
      const comFolga = (dataIso, dias) => {
        const d = new Date(`${dataIso}T12:00:00`)
        d.setDate(d.getDate() + dias)
        return d.toISOString().slice(0, 10)
      }

      const { data: transferenciasNoApp } = await supabase
        .from('lancamentos_cc')
        .select('data, valor')
        .eq('user_id', user.id)
        .eq('conta_id', contaId)
        .eq('tipo', 'transferencia')
        .gte('data', comFolga(extrato.periodo.inicio, -7))
        .lte('data', comFolga(extrato.periodo.fim, 7))

      const transferencias = casarTransferenciasProprias(
        lancamentos.filter(l => l.ehTransferenciaPropria),
        transferenciasNoApp ?? []
      )

      return {
        extrato,
        lancamentos,
        arquivoNome: arquivo.name,
        manuaisNoPeriodo: count ?? 0,
        temAnteriores: (anteriores ?? 0) > 0,
        transferencias,
      }
    } catch (e) {
      setErro(e.message)
      throw e
    } finally {
      setEtapa('parado')
    }
  }

  /**
   * Grava o extrato substituindo o que foi lançado à mão no período.
   *
   * A ordem importa: insere primeiro, apaga depois. Se a inserção falhar no
   * meio, o que ela já tinha continua lá — e a importação parcial se desfaz
   * pelo importacao_id. O contrário perderia dados numa falha de rede.
   *
   * Transferências não são apagadas: cada uma tem uma perna na outra conta, e
   * apagar só este lado deixaria a outra órfã.
   */
  async function importarExtrato({ lancamentos, extrato, contaId, banco, arquivoNome, criarSaldoInicial }) {
    setErro(null)
    setEtapa('gravando')
    try {
      const escolhidos = lancamentos.filter(l => l.incluir !== false)

      const { data: importacao, error: erroImportacao } = await supabase
        .from('importacoes')
        .insert([{
          user_id: user.id,
          tipo: 'extrato_cc',
          banco: banco ?? null,
          conta_id: contaId,
          arquivo_nome: arquivoNome ?? null,
          periodo_inicio: extrato.periodo.inicio,
          periodo_fim: extrato.periodo.fim,
          total_lidos: lancamentos.length,
        }])
        .select()
        .single()
      if (erroImportacao) throw erroImportacao

      const chaves = montarChavesDedup(escolhidos)
      const registros = escolhidos.map((l, i) => ({
        user_id: user.id,
        conta_id: contaId,
        data: l.data,
        descricao: l.descricao || null,
        valor: l.valor,
        tipo: l.tipo,
        categoria: l.categoria || null,
        origem: l.origem ?? 'marina',
        forma_pagamento: null,
        importacao_id: importacao.id,
        dedup_chave: chaves[i],
        revisado: false,
      }))

      if (criarSaldoInicial && extrato.saldoInicial !== 0) {
        // Um dia antes do primeiro lançamento, para não se misturar com ele.
        const vespera = new Date(`${extrato.periodo.inicio}T12:00:00`)
        vespera.setDate(vespera.getDate() - 1)
        registros.unshift({
          user_id: user.id,
          conta_id: contaId,
          data: vespera.toISOString().slice(0, 10),
          descricao: 'Saldo anterior ao extrato',
          valor: Math.abs(extrato.saldoInicial),
          tipo: extrato.saldoInicial >= 0 ? 'entrada' : 'saida',
          categoria: 'Saldo Histórico',
          origem: 'marina',
          forma_pagamento: null,
          importacao_id: importacao.id,
          dedup_chave: `saldo-inicial|${contaId}|${extrato.periodo.inicio}`,
          revisado: true,
        })
      }

      let inseridos = 0
      for (let i = 0; i < registros.length; i += LOTE) {
        const { data, error } = await supabase
          .from('lancamentos_cc')
          .upsert(registros.slice(i, i + LOTE), {
            onConflict: 'user_id,dedup_chave',
            ignoreDuplicates: true,
          })
          .select('id')
        if (error) throw error
        inseridos += data?.length ?? 0
      }

      // Só agora o antigo sai de cena.
      const { data: apagados, error: erroDelete } = await supabase
        .from('lancamentos_cc')
        .delete()
        .eq('user_id', user.id)
        .eq('conta_id', contaId)
        .gte('data', extrato.periodo.inicio)
        .lte('data', extrato.periodo.fim)
        .neq('tipo', 'transferencia')
        .is('importacao_id', null)
        .select('id')
      if (erroDelete) {
        throw new Error(
          `Os lançamentos novos entraram, mas não consegui apagar os antigos — pode haver duplicata. ` +
          `Desfaça a importação ${importacao.id} e tente de novo.`
        )
      }

      await supabase
        .from('importacoes')
        .update({ total_importados: inseridos, total_duplicados: registros.length - inseridos })
        .eq('id', importacao.id)

      invalidarTudo()
      return {
        importacaoId: importacao.id,
        importados: inseridos,
        substituidos: apagados?.length ?? 0,
        duplicados: registros.length - inseridos,
      }
    } catch (e) {
      setErro(e.message ?? 'Não consegui gravar os lançamentos.')
      throw e
    } finally {
      setEtapa('parado')
    }
  }

  /**
   * Confere o resultado contra o banco: soma tudo que existe na conta até a
   * data final do extrato e compara com o saldo que o próprio arquivo declara.
   */
  async function conferirSaldo({ contaId, extrato }) {
    const { data, error } = await supabase
      .from('lancamentos_cc')
      .select('tipo, valor, direcao')
      .eq('user_id', user.id)
      .eq('conta_id', contaId)
      .lte('data', extrato.periodo.fim)
    if (error) throw error

    const saldoApp = (data ?? []).reduce((acc, l) => {
      const v = Number(l.valor)
      if (l.tipo === 'entrada') return acc + v
      if (l.tipo === 'saida') return acc - v
      return acc + (l.direcao === 'entrada' ? v : -v)
    }, 0)

    const diferenca = Number((saldoApp - extrato.saldoFinal).toFixed(2))
    return { saldoApp: Number(saldoApp.toFixed(2)), saldoBanco: extrato.saldoFinal, diferenca, fecha: Math.abs(diferenca) < 0.011 }
  }

  // ---------------------------------------------------------------- fatura PDF

  async function lerFaturaPdf({ arquivo, senha, faturaMes }) {
    setErro(null)
    setEtapa('lendo')
    try {
      const indice = await carregarIndiceCategorias('gastos_cartao')
      const { texto } = await extrairTextoPdf(arquivo, senha)

      setEtapa('interpretando')
      const resposta = await fetch('/api/ler-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, tipo: 'fatura_cartao' }),
      })
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(dados.erro ?? 'Não consegui ler o documento.')
      if (!dados.linhas?.length) {
        throw new Error('Não encontrei nenhum lançamento nesse arquivo. Confira se é mesmo a fatura.')
      }

      return {
        ...dados,
        arquivoNome: arquivo.name,
        lancamentos: linhasFaturaParaGastos(dados.linhas, { faturaMes, indiceCategorias: indice }),
      }
    } catch (e) {
      setErro(e.message)
      throw e
    } finally {
      setEtapa('parado')
    }
  }

  async function importarFatura({ lancamentos, faturaMes, banco, arquivoNome }) {
    setErro(null)
    setEtapa('gravando')
    try {
      const escolhidos = lancamentos.filter(l => l.incluir !== false)

      const { data: importacao, error: erroImportacao } = await supabase
        .from('importacoes')
        .insert([{
          user_id: user.id,
          tipo: 'fatura_cartao',
          banco: banco ?? null,
          arquivo_nome: arquivoNome ?? null,
          fatura_mes: faturaMes,
          total_lidos: lancamentos.length,
        }])
        .select()
        .single()
      if (erroImportacao) throw erroImportacao

      const chaves = montarChavesDedup(escolhidos)
      const registros = escolhidos.map((l, i) => ({
        user_id: user.id,
        data: l.data,
        descricao: l.descricao || null,
        valor: l.valor,
        categoria: l.categoria || null,
        origem: l.origem ?? 'marina',
        fatura_mes: l.fatura_mes ?? faturaMes,
        importacao_id: importacao.id,
        dedup_chave: chaves[i],
        revisado: false,
      }))

      let inseridos = 0
      for (let i = 0; i < registros.length; i += LOTE) {
        const { data, error } = await supabase
          .from('gastos_cartao')
          .upsert(registros.slice(i, i + LOTE), {
            onConflict: 'user_id,dedup_chave',
            ignoreDuplicates: true,
          })
          .select('id')
        if (error) throw error
        inseridos += data?.length ?? 0
      }

      await supabase
        .from('importacoes')
        .update({ total_importados: inseridos, total_duplicados: registros.length - inseridos })
        .eq('id', importacao.id)

      invalidarTudo()
      return { importacaoId: importacao.id, importados: inseridos, duplicados: registros.length - inseridos }
    } catch (e) {
      setErro(e.message ?? 'Não consegui gravar os lançamentos.')
      throw e
    } finally {
      setEtapa('parado')
    }
  }

  /** Desfaz uma importação inteira — remove só o que veio dela. */
  async function desfazer({ importacaoId, tipo }) {
    const tabela = tipo === 'fatura_cartao' ? 'gastos_cartao' : 'lancamentos_cc'
    const { error } = await supabase.from(tabela).delete().eq('importacao_id', importacaoId)
    if (error) throw error
    await supabase.from('importacoes').delete().eq('id', importacaoId)
    invalidarTudo()
  }

  return {
    etapa,
    erro,
    ocupado: etapa !== 'parado',
    lerExtrato,
    importarExtrato,
    conferirSaldo,
    lerFaturaPdf,
    importarFatura,
    desfazer,
  }
}
