import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DayPicker } from 'react-day-picker'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Download, Calendar, ChevronDown } from 'lucide-react'
import { useRelatorio } from '../hooks/useRelatorio'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { PageHeader } from '../components/PageHeader'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import 'react-day-picker/style.css'

const MODULOS = ['Tudo', 'Conta-Corrente', 'Cartão']
const ORIGENS = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'ajuda_de_custo', label: '💼 Ajuda de custo' },
  { value: 'marina', label: '👩 Marina' },
]

const CORES_BARRAS = [
  '#1A3D2B','#2D5C3E','#7EC8A4','#C8E6D8',
  '#EC7000','#FF6600','#D97706','#C0392B',
]

export function Relatorio() {
  const hoje = new Date()
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(hoje),
    to: endOfMonth(hoje),
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [modulo, setModulo] = useState('Tudo')
  const [origem, setOrigem] = useState('tudo')

  const { isLoading, despesas, receitas, totalDespesas, totalReceitas, raw } =
    useRelatorio(dateRange?.from, dateRange?.to, modulo, origem)

  const rangeLabel = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'dd/MM/yyyy')} – ${format(dateRange.to, 'dd/MM/yyyy')}`
    : 'Selecionar período'

  function exportarExcel() {
    const wb = XLSX.utils.book_new()

    // Aba Resumo
    const resumoRows = [
      ['Categoria', 'Tipo', 'Total (R$)'],
      ...despesas.map(d => [d.categoria, 'Despesa', d.total]),
      [],
      ...receitas.map(r => [r.categoria, 'Receita', r.total]),
      [],
      ['TOTAL DESPESAS', '', totalDespesas],
      ['TOTAL RECEITAS', '', totalReceitas],
      ['SALDO', '', totalReceitas - totalDespesas],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoRows), 'Resumo')

    // Aba Conta-Corrente
    if (raw.lancamentos.length > 0) {
      const ccRows = [
        ['Data', 'Descrição', 'Categoria', 'Forma Pagamento', 'Banco', 'Origem', 'Valor', 'Tipo'],
        ...raw.lancamentos.map(l => [
          l.data,
          l.descricao,
          l.categoria ?? '',
          l.forma_pagamento ?? '',
          l.contas?.nome ?? '',
          l.origem ?? 'marina',
          Number(l.valor),
          l.tipo,
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ccRows), 'Conta-Corrente')
    }

    // Aba Cartão
    if (raw.gastos_cartao.length > 0) {
      const cartaoRows = [
        ['Data', 'Descrição', 'Categoria', 'Fatura', 'Origem', 'Valor'],
        ...raw.gastos_cartao.map(g => [
          g.data, g.descricao, g.categoria ?? '', g.fatura_mes, g.origem ?? 'marina', Number(g.valor),
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cartaoRows), 'Cartão')
    }

    // Aba Ajuda de Custo (sempre inclui todos os itens com origem=ajuda_de_custo)
    const ajudaCC = raw.lancamentos.filter(l => l.origem === 'ajuda_de_custo')
    const ajudaCartao = raw.gastos_cartao.filter(g => g.origem === 'ajuda_de_custo')
    if (ajudaCC.length > 0 || ajudaCartao.length > 0) {
      const ajudaRows = [
        ['Data', 'Descrição', 'Categoria', 'Fonte', 'Valor', 'Tipo'],
        ...ajudaCC.map(l => [
          l.data, l.descricao, l.categoria ?? '', l.contas?.nome ?? 'CC', Number(l.valor), l.tipo === 'entrada' ? 'Recebimento' : 'Gasto',
        ]),
        ...ajudaCartao.map(g => [
          g.data, g.descricao, g.categoria ?? '', 'Cartão', Number(g.valor), 'Gasto',
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ajudaRows), 'Ajuda de Custo')
    }

    const nomeArquivo = `financas-marina-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
    XLSX.writeFile(wb, nomeArquivo)
  }

  const graficoData = despesas.map(d => ({
    name: d.categoria.length > 14 ? d.categoria.slice(0, 13) + '…' : d.categoria,
    total: d.total,
  }))

  return (
    <div>
      <PageHeader title="Relatório" />

      <div className="px-4 md:px-0 pb-28 md:pb-0 space-y-4">

        {/* Filtros */}
        <Card>
          <div className="flex flex-col gap-3">
            {/* Período */}
            <div className="relative">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1.5">Período</p>
              <button
                onClick={() => setPickerOpen(v => !v)}
                className="flex items-center gap-2 w-full px-4 py-3 bg-cream rounded-xl border border-cream-dark text-sm text-text-primary text-left hover:border-green-deep transition-colors"
              >
                <Calendar size={15} className="text-text-muted" />
                <span className="flex-1">{rangeLabel}</span>
                <ChevronDown size={15} className="text-text-muted" />
              </button>
              {pickerOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-surface rounded-2xl shadow-xl border border-cream-dark p-2 rdp-marina">
                  <DayPicker
                    mode="range"
                    selected={dateRange}
                    onSelect={r => {
                      setDateRange(r)
                      if (r?.from && r?.to) setPickerOpen(false)
                    }}
                    locale={ptBR}
                  />
                </div>
              )}
            </div>

            {/* Módulo */}
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1.5">Módulo</p>
              <div className="flex gap-1 bg-cream-dark p-1 rounded-xl">
                {MODULOS.map(m => (
                  <button
                    key={m}
                    onClick={() => setModulo(m)}
                    className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-colors
                      ${modulo === m ? 'bg-surface text-green-deep shadow-sm' : 'text-text-muted'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Origem + Exportar */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-1.5">Origem</p>
                <div className="flex gap-1 bg-cream-dark p-1 rounded-xl">
                  {ORIGENS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setOrigem(o.value)}
                      className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-colors
                        ${origem === o.value ? 'bg-surface text-green-deep shadow-sm' : 'text-text-muted'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={exportarExcel}
                disabled={isLoading || (despesas.length === 0 && receitas.length === 0)}
                className="gap-1.5 text-xs px-3 py-2 h-auto self-end mb-1"
              >
                <Download size={14} />
                Excel
              </Button>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center py-10 text-text-muted text-sm">Carregando...</div>
        ) : (
          <>
            {/* Totais */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center">
                <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Receitas</p>
                <p className="font-mono font-bold text-green-deep text-sm">{formatCurrency(totalReceitas)}</p>
              </Card>
              <Card className="text-center">
                <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Despesas</p>
                <p className="font-mono font-bold text-danger text-sm">{formatCurrency(totalDespesas)}</p>
              </Card>
              <Card className="text-center">
                <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Saldo</p>
                <p className={`font-mono font-bold text-sm ${totalReceitas - totalDespesas >= 0 ? 'text-green-deep' : 'text-danger'}`}>
                  {formatCurrency(totalReceitas - totalDespesas)}
                </p>
              </Card>
            </div>

            {/* Gráfico de despesas */}
            {despesas.length > 0 && (
              <Card>
                <h2 className="text-sm font-semibold text-text-primary mb-4">Despesas por categoria</h2>
                <div style={{ height: Math.max(180, despesas.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={graficoData} margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D0" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: '#8BA898', fontFamily: 'DM Mono' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => `${(v / 1000).toFixed(1)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 11, fill: '#4A6458' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={v => formatCurrency(v)}
                        contentStyle={{ background: '#fff', border: '1px solid #E5E0D0', borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                        {graficoData.map((_, i) => (
                          <Cell key={i} fill={CORES_BARRAS[i % CORES_BARRAS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {/* Despesas detalhadas */}
            {despesas.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-text-secondary mb-2">Despesas detalhadas</h2>
                <div className="flex flex-col gap-3">
                  {despesas.map(d => (
                    <CategoriaGroup key={d.categoria} categoria={d.categoria} total={d.total} items={d.items} tipo="despesa" />
                  ))}
                </div>
              </section>
            )}

            {/* Receitas detalhadas */}
            {receitas.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-text-secondary mb-2">Receitas detalhadas</h2>
                <div className="flex flex-col gap-3">
                  {receitas.map(r => (
                    <CategoriaGroup key={r.categoria} categoria={r.categoria} total={r.total} items={r.items} tipo="receita" />
                  ))}
                </div>
              </section>
            )}

            {despesas.length === 0 && receitas.length === 0 && (
              <div className="text-center py-12 text-text-muted text-sm">
                Nenhum lançamento no período selecionado
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CategoriaGroup({ categoria, total, items, tipo }) {
  const [open, setOpen] = useState(false)
  const isReceita = tipo === 'receita'

  return (
    <Card className="p-0 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-cream/50 transition-colors"
      >
        <span className="text-sm font-medium text-text-primary">{categoria}</span>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-sm font-bold ${isReceita ? 'text-green-deep' : 'text-danger'}`}>
            {isReceita ? '+' : '-'}{formatCurrency(total)}
          </span>
          <ChevronDown size={14} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-cream-dark">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-cream-dark/50 last:border-0">
              <div>
                <p className="text-xs text-text-primary">{item.descricao || item.origem || '—'}</p>
                <p className="text-[10px] text-text-muted">{formatDate(item.data)} · {item.fonte}</p>
              </div>
              <span className={`font-mono text-xs font-semibold ${isReceita ? 'text-green-deep' : 'text-danger'}`}>
                {formatCurrency(Number(item.valor))}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
