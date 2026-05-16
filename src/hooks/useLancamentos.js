import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useLancamentos(mesRef) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['lancamentos', user?.id, mesRef],
    queryFn: async () => {
      const startDate = `${mesRef}-01`
      const [year, month] = mesRef.split('-').map(Number)
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${mesRef}-${String(lastDay).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('lancamentos_cc')
        .select('*, contas(nome, cor)')
        .eq('user_id', user.id)
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data', { ascending: false })

      if (error) throw error
      return data ?? []
    },
    enabled: !!user && !!mesRef,
    staleTime: 1000 * 30,
  })

  const addMutation = useMutation({
    mutationFn: async (payload) => {
      if (payload.tipo === 'transferencia') {
        return criarTransferencia(user.id, payload)
      }
      const { data, error } = await supabase
        .from('lancamentos_cc')
        .insert([{ ...payload, user_id: user.id }])
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lancamentos'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data: lancamento } = await supabase
        .from('lancamentos_cc')
        .select('transferencia_par_id')
        .eq('id', id)
        .single()

      const ids = [id]
      if (lancamento?.transferencia_par_id) ids.push(lancamento.transferencia_par_id)

      const { error } = await supabase
        .from('lancamentos_cc')
        .delete()
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lancamentos'] }),
  })

  return {
    lancamentos: query.data ?? [],
    isLoading: query.isLoading,
    add: addMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isRemoving: deleteMutation.isPending,
  }
}

async function criarTransferencia(userId, payload) {
  const { contaOrigemId, contaDestinoId, valor, descricao, data, categoria } = payload

  // Inserir saída na origem (sem par ainda)
  const { data: saida, error: e1 } = await supabase
    .from('lancamentos_cc')
    .insert([{
      user_id: userId,
      conta_id: contaOrigemId,
      data,
      descricao: descricao || 'Transferência',
      tipo: 'transferencia',
      valor: Math.abs(valor),
      categoria: categoria || null,
    }])
    .select()
    .single()
  if (e1) throw e1

  // Inserir entrada no destino com par = saída
  const { data: entrada, error: e2 } = await supabase
    .from('lancamentos_cc')
    .insert([{
      user_id: userId,
      conta_id: contaDestinoId,
      data,
      descricao: descricao || 'Transferência',
      tipo: 'transferencia',
      valor: Math.abs(valor),
      categoria: categoria || null,
      transferencia_par_id: saida.id,
    }])
    .select()
    .single()
  if (e2) throw e2

  // Atualizar saída com par = entrada
  await supabase
    .from('lancamentos_cc')
    .update({ transferencia_par_id: entrada.id })
    .eq('id', saida.id)

  return [saida, entrada]
}
