import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

async function ensureContasExistem(userId) {
  const { data: existing } = await supabase
    .from('contas')
    .select('id, nome')
    .eq('user_id', userId)

  if (existing && existing.length > 0) return existing

  const { data } = await supabase
    .from('contas')
    .insert([
      { user_id: userId, nome: 'Itaú', cor: '#EC7000', ativa: true },
      { user_id: userId, nome: 'Inter', cor: '#FF6600', ativa: true },
    ])
    .select()

  return data
}

export function useContas() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['contas', user?.id],
    queryFn: async () => {
      const contas = await ensureContasExistem(user.id)
      return contas
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  })

  return {
    contas: query.data ?? [],
    isLoading: query.isLoading,
    contaItau: query.data?.find(c => c.nome === 'Itaú'),
    contaInter: query.data?.find(c => c.nome === 'Inter'),
  }
}
