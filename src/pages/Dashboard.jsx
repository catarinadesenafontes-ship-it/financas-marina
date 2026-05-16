import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useContas } from '../hooks/useContas'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { formatCurrency } from '../utils/formatCurrency'
import { currentMonthRef } from '../utils/formatDate'

function useDashboardData() {
  const { user } = useAuth()
  const mesRef = currentMonthRef()

  return useQuery({
    queryKey: ['dashboard', user?.id, mesRef],
    queryFn: async () => {
      const [lancamentos, cartao, mesada, contas] = await Promise.all([
        supabase
          .from('lancamentos_cc')
          .select('*, contas(nome)')
          .eq('user_id', user.id),
        supabase
          .from('gastos_cartao')
          .select('valor, fatura_mes')
          .eq('user_id', user.id)
          .eq('fatura_mes', mesRef),
        supabase
          .from('mesada')
          .select('valor')
          .eq('user_id', user.id)
          .eq('mes_referencia', mesRef),
        supabase
          .from('contas')
          .select('id, nome')
          .eq('user_id', user.id),
      ])

      return {
        lancamentos: lancamentos.data ?? [],
        cartaoMes: cartao.data ?? [],
        mesadaMes: mesada.data ?? [],
        contas: contas.data ?? [],
      }
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  })
}

function useSeis() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dashboard_6m', user?.id],
    queryFn: async () => {
      const rows = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        rows.push(mes)
      }

      const allPromises = rows.map(m => {
        const [y, mo] = m.split('-').map(Number)
        const lastDay = new Date(y, mo, 0).getDate()
        return supabase
          .from('lancamentos_cc')
          .select('valor, tipo, data')
          .eq('user_id', user.id)
          .gte('data', `${m}-01`)
          .lte('data', `${m}-${lastDay}`)
          .then(({ data }) => ({
            mes: m,
            total: (data ?? [])
              .filter(l => l.tipo === 'saida')
              .reduce((s, l) => s + Number(l.valor), 0),
          }))
      })
      return Promise.all(allPromises)
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  })
}

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function BankBadge({ banco }) {
  if (!banco) return null
  const isItau = banco === 'Itaú'
  return (
    <span
      className={`inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-md text-[10px] font-bold italic text-white mb-1`}
      style={{ background: isItau ? '#EC7000' : '#FF6600', borderRadius: isItau ? '4px' : '999px' }}
    >
      i <span className="not-italic font-semibold">{banco}</span>
    </span>
  )
}

function SummaryCard({ label, value, color = 'text-text-primary', banco }) {
  return (
    <Card className="flex flex-col gap-1">
      {banco ? <BankBadge banco={banco} /> : (
        <span className="text-xs text-text-muted font-medium uppercase tracking-wide">{label}</span>
      )}
      <span className={`font-mono font-bold text-lg ${color}`}>{formatCurrency(value)}</span>
    </Card>
  )
}

export function Dashboard() {
  const { data, isLoading } = useDashboardData()
  const { data: seis } = useSeis()
  const { contas: contasInfo } = useContas()

  const saldos = useMemo(() => {
    if (!data) return { itau: 0, inter: 0 }
    const itauConta = contasInfo.find(c => c.nome === 'Itaú')
    const interConta = contasInfo.find(c => c.nome === 'Inter')

    function calcContaSaldo(contaId) {
      return (data.lancamentos ?? [])
        .filter(l => l.conta_id === contaId)
        .reduce((acc, l) => {
          if (l.tipo === 'entrada') return acc + Number(l.valor)
          if (l.tipo === 'saida') return acc - Number(l.valor)
          if (l.tipo === 'transferencia') {
            const isEntrada = data.lancamentos.some(
              lp => lp.id === l.transferencia_par_id && lp.conta_id !== contaId
            )
            return acc + (isEntrada ? Number(l.valor) : -Number(l.valor))
          }
          return acc
        }, 0)
    }

    const itau = itauConta ? calcContaSaldo(itauConta.id) : 0
    const inter = interConta ? calcContaSaldo(interConta.id) : 0
    return { itau, inter }
  }, [data, contasInfo])

  const faturaAberta = useMemo(() =>
    (data?.cartaoMes ?? []).reduce((s, g) => s + Number(g.valor), 0), [data])

  const saldoMesada = useMemo(() => {
    const recebido = (data?.mesadaMes ?? []).reduce((s, r) => s + Number(r.valor), 0)
    return recebido
  }, [data])

  const graficoData = useMemo(() =>
    (seis ?? []).map(row => ({
      name: MESES_PT[parseInt(row.mes.split('-')[1], 10) - 1],
      Gastos: row.total,
    })), [seis])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Carregando...
      </div>
    )
  }

  const consolidado = saldos.itau + saldos.inter

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" />

      <div className="px-4 md:px-0 space-y-5 pb-28 md:pb-0">
        {/* Cards de resumo */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            banco="Itaú"
            value={saldos.itau}
            color={saldos.itau >= 0 ? 'text-green-deep' : 'text-danger'}
          />
          <SummaryCard
            banco="Inter"
            value={saldos.inter}
            color={saldos.inter >= 0 ? 'text-green-deep' : 'text-danger'}
          />
          <SummaryCard
            label="Fatura aberta"
            value={faturaAberta}
            color="text-warning"
          />
          <SummaryCard
            label="Mesada recebida"
            value={saldoMesada}
            color="text-green-mid"
          />
        </div>

        {/* Badge consolidado */}
        <div className="flex justify-center">
          <div className="bg-green-pale text-green-deep text-xs font-mono font-medium px-4 py-2 rounded-full">
            Consolidado: {formatCurrency(consolidado)}
          </div>
        </div>

        {/* Gráfico */}
        <Card>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Gastos últimos 6 meses</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficoData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#8BA898' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#8BA898', fontFamily: 'DM Mono' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={v => formatCurrency(v)}
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #E5E0D0',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Gastos" fill="#1A3D2B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
