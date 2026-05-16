import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useMesada(mesRef) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const recebimentosQuery = useQuery({
    queryKey: ['mesada_recebimentos', user?.id, mesRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mesada')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes_referencia', mesRef)
        .order('data', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user && !!mesRef,
    staleTime: 1000 * 30,
  })

  const gastosQuery = useQuery({
    queryKey: ['gastos_mesada', user?.id, mesRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos_mesada')
        .select('*')
        .eq('user_id', user.id)
        .eq('mes_referencia', mesRef)
        .order('data', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user && !!mesRef,
    staleTime: 1000 * 30,
  })

  const addRecebimento = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('mesada')
        .insert([{ ...payload, user_id: user.id, mes_referencia: mesRef }])
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mesada_recebimentos'] }),
  })

  const addGasto = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('gastos_mesada')
        .insert([{ ...payload, user_id: user.id, mes_referencia: mesRef }])
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gastos_mesada'] }),
  })

  const deleteRecebimento = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('mesada').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mesada_recebimentos'] }),
  })

  const deleteGasto = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('gastos_mesada').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gastos_mesada'] }),
  })

  const totalRecebido = (recebimentosQuery.data ?? []).reduce((s, r) => s + Number(r.valor), 0)
  const totalGasto = (gastosQuery.data ?? []).reduce((s, g) => s + Number(g.valor), 0)

  return {
    recebimentos: recebimentosQuery.data ?? [],
    gastos: gastosQuery.data ?? [],
    totalRecebido,
    totalGasto,
    saldo: totalRecebido - totalGasto,
    isLoading: recebimentosQuery.isLoading || gastosQuery.isLoading,
    addRecebimento: addRecebimento.mutateAsync,
    addGasto: addGasto.mutateAsync,
    deleteRecebimento: deleteRecebimento.mutateAsync,
    deleteGasto: deleteGasto.mutateAsync,
  }
}
