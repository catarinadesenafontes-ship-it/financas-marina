import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

function monthDateRange(mesRef) {
  const [y, m] = mesRef.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: `${mesRef}-01`, to: `${mesRef}-${String(lastDay).padStart(2, '0')}` }
}

export function useMesada(mesRef) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['mesada_ajuda', user?.id, mesRef],
    queryFn: async () => {
      const { from, to } = monthDateRange(mesRef)
      const [cc, cartao] = await Promise.all([
        supabase
          .from('lancamentos_cc')
          .select('*, contas(nome)')
          .eq('user_id', user.id)
          .eq('origem', 'ajuda_de_custo')
          .gte('data', from)
          .lte('data', to)
          .order('data', { ascending: false }),
        supabase
          .from('gastos_cartao')
          .select('*')
          .eq('user_id', user.id)
          .eq('origem', 'ajuda_de_custo')
          .gte('data', from)
          .lte('data', to)
          .order('data', { ascending: false }),
      ])
      return {
        lancamentos: cc.data ?? [],
        gastos_cartao: cartao.data ?? [],
      }
    },
    enabled: !!user && !!mesRef,
    staleTime: 1000 * 30,
  })

  const deleteLancamento = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('lancamentos_cc').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesada_ajuda'] })
      qc.invalidateQueries({ queryKey: ['lancamentos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const deleteGasto = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('gastos_cartao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesada_ajuda'] })
      qc.invalidateQueries({ queryKey: ['gastos_cartao'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const lancamentos = query.data?.lancamentos ?? []
  const gastos_cartao = query.data?.gastos_cartao ?? []

  const totalRecebido = lancamentos
    .filter(l => l.tipo === 'entrada')
    .reduce((s, l) => s + Number(l.valor), 0)

  const totalGasto = lancamentos
    .filter(l => l.tipo === 'saida')
    .reduce((s, l) => s + Number(l.valor), 0) +
    gastos_cartao.reduce((s, g) => s + Number(g.valor), 0)

  const allItems = [
    ...lancamentos.map(l => ({
      ...l,
      fonte: l.contas?.nome ?? 'CC',
      isReceita: l.tipo === 'entrada',
      isCartao: false,
    })),
    ...gastos_cartao.map(g => ({
      ...g,
      fonte: 'Cartão',
      isReceita: false,
      isCartao: true,
    })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  return {
    allItems,
    totalRecebido,
    totalGasto,
    saldo: totalRecebido - totalGasto,
    isLoading: query.isLoading,
    deleteLancamento: deleteLancamento.mutateAsync,
    deleteGasto: deleteGasto.mutateAsync,
  }
}
