import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { currentMonthRef } from '../utils/formatDate'
import { CATEGORIAS_OCULTAS_ANALISES } from '../utils/categorias'

function getMonthRef(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthDateRange(mesRef) {
  const [y, m] = mesRef.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { from: `${mesRef}-01`, to: `${mesRef}-${String(lastDay).padStart(2, '0')}` }
}

async function fetchMesData(userId, mesRef) {
  const { from, to } = monthDateRange(mesRef)
  const [cc, cartao] = await Promise.all([
    supabase.from('lancamentos_cc').select('valor,tipo,categoria,data,origem').eq('user_id', userId).gte('data', from).lte('data', to),
    supabase.from('gastos_cartao').select('valor,categoria,data').eq('user_id', userId).eq('fatura_mes', mesRef),
  ])
  return {
    lancamentos: cc.data ?? [],
    gastos_cartao: cartao.data ?? [],
  }
}

export function useInsights() {
  const { user } = useAuth()
  const mesRef = currentMonthRef()
  const diaHoje = new Date().getDate()

  const query = useQuery({
    queryKey: ['insights', user?.id, mesRef],
    queryFn: async () => {
      const [mesAtual, mes1, mes2, mes3, config] = await Promise.all([
        fetchMesData(user.id, mesRef),
        fetchMesData(user.id, getMonthRef(-1)),
        fetchMesData(user.id, getMonthRef(-2)),
        fetchMesData(user.id, getMonthRef(-3)),
        supabase.from('configuracao_cartao').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      return { mesAtual, mes1, mes2, mes3, config: config.data }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })

  function gerarInsights(data) {
    if (!data) return []
    const { mesAtual, mes1, mes2, mes3, config } = data
    const insights = []

    const totalGastosMes = (lancamentos, gastos_cartao) =>
      lancamentos.filter(l => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0) +
      gastos_cartao.reduce((s, g) => s + Number(g.valor), 0)

    const totalReceitasMes = (lancamentos) =>
      lancamentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + Number(l.valor), 0)

    const gastoPorCat = (lancamentos, gastos_cartao) => {
      const map = {}
      lancamentos.filter(l => l.tipo === 'saida').forEach(l => {
        const cat = l.categoria ?? 'Outros'
        map[cat] = (map[cat] ?? 0) + Number(l.valor)
      })
      gastos_cartao.forEach(g => {
        const cat = g.categoria ?? 'Outros'
        map[cat] = (map[cat] ?? 0) + Number(g.valor)
      })
      return map
    }

    const { lancamentos: lAtualRaw, gastos_cartao: gcAtual } = mesAtual
    const lAtual = lAtualRaw.filter(l => !CATEGORIAS_OCULTAS_ANALISES.includes(l.categoria))

    const totalGastos = totalGastosMes(lAtual, gcAtual)
    const totalReceitas = totalReceitasMes(lAtual)
    const catAtual = gastoPorCat(lAtual, gcAtual)
    const catAnterior = gastoPorCat(mes1.lancamentos.filter(l => !CATEGORIAS_OCULTAS_ANALISES.includes(l.categoria)), mes1.gastos_cartao)
    const totalLancamentosMes = lAtual.length + gcAtual.length

    // Dados insuficientes
    if (totalLancamentosMes < 5) {
      return [{
        type: 'neutral',
        emoji: '🌿',
        title: 'Ainda sem dados suficientes',
        message: 'Continue registrando seus lançamentos para receber insights personalizados.',
      }]
    }

    const pct = (v, total) => total > 0 ? Math.round((v / total) * 100) : 0
    const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

    // --- CATEGORIA GASTOS ---

    // Lanches > 20% da receita
    const gastoLanches = catAtual['Lanches'] ?? 0
    if (gastoLanches > 0 && totalReceitas > 0) {
      const p = pct(gastoLanches, totalReceitas)
      if (p > 20) {
        const sugestao = Math.round(totalReceitas * 0.15)
        insights.push({
          type: 'warning',
          emoji: '🍔',
          title: 'Gastos com Lanches',
          message: `Você gastou ${p}% da sua renda em Lanches este mês. Que tal definir um limite de ${fmt(sugestao)} para o próximo?`,
        })
      }
    }

    // Uber > 15% da receita
    const gastoUber = catAtual['Uber'] ?? 0
    if (gastoUber > 0 && totalReceitas > 0) {
      const p = pct(gastoUber, totalReceitas)
      if (p > 15) {
        insights.push({
          type: 'warning',
          emoji: '🚗',
          title: 'Gastos com Uber',
          message: `Transporte via Uber está consumindo ${p}% da sua renda. Considere avaliar alternativas para trajetos fixos.`,
        })
      }
    }

    // Categoria cresceu > 30% vs mês anterior
    for (const [cat, valor] of Object.entries(catAtual)) {
      const anterior = catAnterior[cat] ?? 0
      if (anterior > 0 && valor > 0) {
        const crescimento = Math.round(((valor - anterior) / anterior) * 100)
        if (crescimento > 30) {
          insights.push({
            type: 'warning',
            emoji: '📈',
            title: `Aumento em ${cat}`,
            message: `Seus gastos com ${cat} aumentaram ${crescimento}% em relação ao mês passado.`,
          })
        } else if (crescimento < -20) {
          insights.push({
            type: 'success',
            emoji: '🌿',
            title: `Redução em ${cat}`,
            message: `Parabéns! Você reduziu ${Math.abs(crescimento)}% nos gastos com ${cat} este mês. 🌿`,
          })
        }
      }
    }

    // --- CARTÃO DE CRÉDITO ---
    const limite = config?.limite ?? 0
    const melhorDia = config?.melhor_dia_compra ?? 19
    const totalCartaoMes = gcAtual.reduce((s, g) => s + Number(g.valor), 0)

    if (limite > 0) {
      const usoCartao = pct(totalCartaoMes, limite)
      if (usoCartao > 70) {
        insights.push({
          type: 'danger',
          emoji: '💳',
          title: 'Limite do cartão alto',
          message: `Você já usou ${usoCartao}% do limite do seu cartão. Fique atenta para não comprometer o mês seguinte.`,
        })
      } else if (usoCartao < 30 && totalCartaoMes > 0) {
        insights.push({
          type: 'success',
          emoji: '✨',
          title: 'Ótimo controle do cartão',
          message: `Ótimo controle! Você usou apenas ${usoCartao}% do limite do cartão este mês.`,
        })
      }
    }

    // Gastos após melhor dia de compra
    const comprasAposDia = gcAtual.filter(g => new Date(g.data + 'T12:00:00').getDate() > melhorDia)
    if (comprasAposDia.length > 0) {
      insights.push({
        type: 'warning',
        emoji: '📅',
        title: 'Compras na virada da fatura',
        message: `Você fez ${comprasAposDia.length} compra${comprasAposDia.length > 1 ? 's' : ''} após o dia ${melhorDia} este mês. Essas compras já entram na próxima fatura — fique de olho.`,
      })
    }

    // --- SALDO ---
    if (totalReceitas > 0) {
      const saldoRestante = totalReceitas - totalGastos
      const pctSaldo = pct(saldoRestante, totalReceitas)

      if (saldoRestante < 0 || (pctSaldo < 20 && diaHoje > 20)) {
        insights.push({
          type: 'danger',
          emoji: '⚠️',
          title: 'Saldo baixo no mês',
          message: 'Seu saldo está baixo para o final do mês. Considere adiar compras não urgentes.',
        })
      } else if (pctSaldo > 40 && diaHoje > 20) {
        insights.push({
          type: 'success',
          emoji: '🌱',
          title: 'Excelente poupança!',
          message: 'Excelente! Você está conseguindo guardar uma parte da sua renda. Considere reservar esse valor.',
        })
      }
    }

    // Ajuda de custo não registrada até dia 10
    const temAjudaEntrada = lAtual.some(l => l.tipo === 'entrada' && l.origem === 'ajuda_de_custo')
    if (diaHoje > 10 && !temAjudaEntrada) {
      insights.push({
        type: 'warning',
        emoji: '💰',
        title: 'Ajuda de custo não registrada',
        message: 'Você ainda não registrou o recebimento da ajuda de custo este mês. Não esqueça de lançar!',
      })
    }

    // --- EVOLUÇÃO ---
    const g0 = totalGastosMes(mes3.lancamentos.filter(l => !CATEGORIAS_OCULTAS_ANALISES.includes(l.categoria)), mes3.gastos_cartao)
    const g1 = totalGastosMes(mes2.lancamentos.filter(l => !CATEGORIAS_OCULTAS_ANALISES.includes(l.categoria)), mes2.gastos_cartao)
    const g2 = totalGastosMes(mes1.lancamentos.filter(l => !CATEGORIAS_OCULTAS_ANALISES.includes(l.categoria)), mes1.gastos_cartao)
    const media3 = (g0 + g1 + g2) / 3

    if (media3 > 0) {
      const diffMedia = Math.round(((totalGastos - media3) / media3) * 100)
      const direcao = diffMedia >= 0 ? 'mais' : 'menos'
      insights.push({
        type: diffMedia >= 0 ? 'warning' : 'success',
        emoji: diffMedia >= 0 ? '📊' : '📉',
        title: 'Comparativo com os últimos 3 meses',
        message: `Este mês você gastou ${Math.abs(diffMedia)}% ${direcao} que sua média dos últimos 3 meses.`,
      })
    }

    // 3 meses consecutivos de redução
    if (g0 > 0 && g1 > 0 && g2 > 0 && g0 > g1 && g1 > g2) {
      insights.push({
        type: 'success',
        emoji: '🏆',
        title: '3 meses seguidos de redução!',
        message: 'Incrível! Você reduziu seus gastos por 3 meses seguidos. Essa consistência faz toda a diferença para sua independência financeira. 🌱',
      })
    }

    // Ordenar: danger → warning → success → neutral
    const order = { danger: 0, warning: 1, success: 2, neutral: 3 }
    return insights.sort((a, b) => order[a.type] - order[b.type])
  }

  return {
    insights: gerarInsights(query.data),
    isLoading: query.isLoading,
  }
}
