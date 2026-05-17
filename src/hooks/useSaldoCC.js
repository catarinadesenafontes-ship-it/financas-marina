import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useContas } from './useContas'

export function useSaldoCC(cutoffDate) {
  const { user } = useAuth()
  const { contaItau, contaInter } = useContas()

  const { data: lanc = [] } = useQuery({
    queryKey: ['saldo_cc', user?.id, cutoffDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_cc')
        .select('conta_id, tipo, valor, transferencia_par_id')
        .eq('user_id', user.id)
        .lte('data', cutoffDate)
      if (error) throw error
      return data ?? []
    },
    enabled: !!user && !!cutoffDate,
    staleTime: 1000 * 30,
  })

  function calcSaldo(contaId) {
    return lanc
      .filter(l => l.conta_id === contaId)
      .reduce((acc, l) => {
        if (l.tipo === 'entrada') return acc + Number(l.valor)
        if (l.tipo === 'saida') return acc - Number(l.valor)
        if (l.tipo === 'transferencia') {
          const isEntrada = lanc.some(
            lp => lp.id === l.transferencia_par_id && lp.conta_id !== contaId
          )
          return acc + (isEntrada ? Number(l.valor) : -Number(l.valor))
        }
        return acc
      }, 0)
  }

  const saldoItau = contaItau ? calcSaldo(contaItau.id) : 0
  const saldoInter = contaInter ? calcSaldo(contaInter.id) : 0

  return { saldoItau, saldoInter, saldoConsolidado: saldoItau + saldoInter }
}
