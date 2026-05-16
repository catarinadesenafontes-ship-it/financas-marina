import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useCartao(faturaRef) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const gastosQuery = useQuery({
    queryKey: ['gastos_cartao', user?.id, faturaRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gastos_cartao')
        .select('*')
        .eq('user_id', user.id)
        .eq('fatura_mes', faturaRef)
        .order('data', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user && !!faturaRef,
    staleTime: 1000 * 30,
  })

  const configQuery = useQuery({
    queryKey: ['config_cartao', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracao_cartao')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return data ?? { limite: 0, dia_fechamento: 1, dia_vencimento: 10 }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })

  const addGasto = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('gastos_cartao')
        .insert([{ ...payload, user_id: user.id, fatura_mes: faturaRef }])
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gastos_cartao'] }),
  })

  const deleteGasto = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('gastos_cartao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gastos_cartao'] }),
  })

  const saveConfig = useMutation({
    mutationFn: async (config) => {
      const { error } = await supabase
        .from('configuracao_cartao')
        .upsert({ ...config, user_id: user.id }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config_cartao'] }),
  })

  const totalGasto = (gastosQuery.data ?? []).reduce((s, g) => s + Number(g.valor), 0)
  const limite = configQuery.data?.limite ?? 0
  const disponivel = limite - totalGasto
  const melhorDiaCompra = configQuery.data?.melhor_dia_compra ?? 19

  return {
    gastos: gastosQuery.data ?? [],
    config: configQuery.data,
    totalGasto,
    limite,
    disponivel,
    melhorDiaCompra,
    isLoading: gastosQuery.isLoading,
    addGasto: addGasto.mutateAsync,
    deleteGasto: deleteGasto.mutateAsync,
    saveConfig: saveConfig.mutateAsync,
    isAdding: addGasto.isPending,
  }
}
