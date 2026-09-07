import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useContas } from './useContas'
import { calcSaldoConta } from '../utils/calcSaldo'
import { todayRef } from '../utils/formatDate'

export function useSaldoCC(cutoffDate) {
  const { user } = useAuth()
  const { contaItau, contaInter } = useContas()

  const { data: lanc = [] } = useQuery({
    queryKey: ['saldo_cc', user?.id, cutoffDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_cc')
        .select('id, conta_id, data, tipo, valor, direcao, transferencia_par_id, created_at')
        .eq('user_id', user.id)
        .lte('data', cutoffDate)
      if (error) throw error
      return data ?? []
    },
    enabled: !!user && !!cutoffDate,
    staleTime: 1000 * 30,
  })

  // Saldo é dinheiro que já se moveu: conta pré-lançada para o mês que vem não
  // entra. Quando o período escolhido passa de hoje, o total até o fim dele
  // continua disponível como projeção, em vez de sumir.
  const hoje = todayRef()
  const cutoffRealizado = cutoffDate && cutoffDate < hoje ? cutoffDate : hoje
  const realizados = lanc.filter(l => l.data <= cutoffRealizado)
  const temProjecao = realizados.length !== lanc.length

  const saldoItau = contaItau ? calcSaldoConta(realizados, contaItau.id) : 0
  const saldoInter = contaInter ? calcSaldoConta(realizados, contaInter.id) : 0

  const projItau = temProjecao && contaItau ? calcSaldoConta(lanc, contaItau.id) : saldoItau
  const projInter = temProjecao && contaInter ? calcSaldoConta(lanc, contaInter.id) : saldoInter

  return {
    saldoItau,
    saldoInter,
    saldoConsolidado: saldoItau + saldoInter,
    projItau,
    projInter,
    projConsolidado: projItau + projInter,
    temProjecao,
  }
}
