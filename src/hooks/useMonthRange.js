import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { formatMonthYear } from '../utils/formatDate'

function generateMonths(from) {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const months = []
  let d = new Date(to)
  while (d >= from) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ value, label: formatMonthYear(value) })
    d = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  }
  return months
}

export function useMonthRange() {
  const { user } = useAuth()

  const { data: months = [] } = useQuery({
    queryKey: ['month_range', user?.id],
    queryFn: async () => {
      const [cc, cartao] = await Promise.all([
        supabase.from('lancamentos_cc').select('data').eq('user_id', user.id).order('data', { ascending: true }).limit(1),
        supabase.from('gastos_cartao').select('data').eq('user_id', user.id).order('data', { ascending: true }).limit(1),
      ])
      const dates = [cc.data?.[0]?.data, cartao.data?.[0]?.data].filter(Boolean)
      if (dates.length === 0) {
        const now = new Date()
        return generateMonths(new Date(now.getFullYear() - 2, now.getMonth(), 1))
      }
      const minStr = dates.sort()[0]
      const minDate = new Date(parseInt(minStr.slice(0, 4)), parseInt(minStr.slice(5, 7)) - 1, 1)
      return generateMonths(minDate)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })

  return { months }
}
