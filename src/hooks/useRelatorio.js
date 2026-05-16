import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRelatorio(dateFrom, dateTo, modulo) {
  const { user } = useAuth()

  const enabled = !!user && !!dateFrom && !!dateTo

  const from = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : null
  const to = dateTo ? format(dateTo, 'yyyy-MM-dd') : null

  const lancamentosQuery = useQuery({
    queryKey: ['relatorio_cc', user?.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_cc')
        .select('*, contas(nome)')
        .eq('user_id', user.id)
        .gte('data', from)
        .lte('data', to)
        .order('data', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: enabled && (modulo === 'Tudo' || modulo === 'Conta-Corrente'),
    staleTime: 1000 * 60,
  })

  const cartaoQuery = useQuery({
    queryKey: ['relatorio_cartao', user?.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos_cartao')
        .select('*')
        .eq('user_id', user.id)
        .gte('data', from)
        .lte('data', to)
        .order('data', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: enabled && (modulo === 'Tudo' || modulo === 'Cartão'),
    staleTime: 1000 * 60,
  })

  const mesadaRecQuery = useQuery({
    queryKey: ['relatorio_mesada_rec', user?.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mesada')
        .select('*')
        .eq('user_id', user.id)
        .gte('data', from)
        .lte('data', to)
        .order('data', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: enabled && (modulo === 'Tudo' || modulo === 'Mesada'),
    staleTime: 1000 * 60,
  })

  const mesadaGastoQuery = useQuery({
    queryKey: ['relatorio_mesada_gasto', user?.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos_mesada')
        .select('*')
        .eq('user_id', user.id)
        .gte('data', from)
        .lte('data', to)
        .order('data', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: enabled && (modulo === 'Tudo' || modulo === 'Mesada'),
    staleTime: 1000 * 60,
  })

  const isLoading = lancamentosQuery.isLoading || cartaoQuery.isLoading ||
    mesadaRecQuery.isLoading || mesadaGastoQuery.isLoading

  const lancamentos = lancamentosQuery.data ?? []
  const gastos_cartao = cartaoQuery.data ?? []
  const mesada_rec = mesadaRecQuery.data ?? []
  const mesada_gasto = mesadaGastoQuery.data ?? []

  // Agrupa despesas por categoria
  const despesasMap = {}

  // Saídas da CC (exclui transferências)
  lancamentos
    .filter(l => l.tipo === 'saida')
    .forEach(l => {
      const cat = l.categoria ?? 'Outros'
      if (!despesasMap[cat]) despesasMap[cat] = { total: 0, items: [] }
      despesasMap[cat].total += Number(l.valor)
      despesasMap[cat].items.push({ ...l, fonte: 'CC', banco: l.contas?.nome })
    })

  // Gastos do cartão
  gastos_cartao.forEach(g => {
    const cat = g.categoria ?? 'Outros'
    if (!despesasMap[cat]) despesasMap[cat] = { total: 0, items: [] }
    despesasMap[cat].total += Number(g.valor)
    despesasMap[cat].items.push({ ...g, fonte: 'Cartão' })
  })

  // Gastos da mesada
  mesada_gasto.forEach(g => {
    const cat = 'Mesada'
    if (!despesasMap[cat]) despesasMap[cat] = { total: 0, items: [] }
    despesasMap[cat].total += Number(g.valor)
    despesasMap[cat].items.push({ ...g, fonte: 'Mesada' })
  })

  // Agrupa receitas por categoria
  const receitasMap = {}

  lancamentos
    .filter(l => l.tipo === 'entrada')
    .forEach(l => {
      const cat = l.categoria ?? 'Receita'
      if (!receitasMap[cat]) receitasMap[cat] = { total: 0, items: [] }
      receitasMap[cat].total += Number(l.valor)
      receitasMap[cat].items.push({ ...l, fonte: 'CC', banco: l.contas?.nome })
    })

  mesada_rec.forEach(r => {
    const cat = 'Mesada Família'
    if (!receitasMap[cat]) receitasMap[cat] = { total: 0, items: [] }
    receitasMap[cat].total += Number(r.valor)
    receitasMap[cat].items.push({ ...r, fonte: 'Mesada', descricao: r.origem })
  })

  const despesas = Object.entries(despesasMap)
    .map(([cat, data]) => ({ categoria: cat, ...data }))
    .sort((a, b) => b.total - a.total)

  const receitas = Object.entries(receitasMap)
    .map(([cat, data]) => ({ categoria: cat, ...data }))
    .sort((a, b) => b.total - a.total)

  const totalDespesas = despesas.reduce((s, d) => s + d.total, 0)
  const totalReceitas = receitas.reduce((s, r) => s + r.total, 0)

  return {
    isLoading,
    despesas,
    receitas,
    totalDespesas,
    totalReceitas,
    // Raw data for Excel export
    raw: { lancamentos, gastos_cartao, mesada_rec, mesada_gasto },
  }
}
