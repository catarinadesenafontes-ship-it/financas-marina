import { useState } from 'react'
import { Trash2, CreditCard, Pencil } from 'lucide-react'
import { useCartao } from '../hooks/useCartao'
import { EditGastoCartaoModal } from '../components/EditGastoCartaoModal'
import { Toast, useToast } from '../components/Toast'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { FAB } from '../components/FAB'
import { Modal } from '../components/Modal'
import { Input, Select } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { MonthSelector } from '../components/MonthSelector'
import { DateRangePicker } from '../components/DateRangePicker'
import { CategoryIcon } from '../components/CategoryIcon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, currentMonthRef } from '../utils/formatDate'
import { CATEGORIAS_DESPESA } from '../utils/categorias'

export function Cartao() {
  const [faturaRef, setFaturaRef] = useState(currentMonthRef)
  const [dateRange, setDateRange] = useState(undefined)
  const [modal, setModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [editTarget, setEditTarget] = useState(null)
  const { toast, showSuccess, showError, hideToast } = useToast()

  const { gastos, totalGasto, limite, disponivel, config, melhorDiaCompra, isLoading, addGasto, deleteGasto, isAdding } = useCartao(faturaRef)

  const bancoCartao = config?.banco ?? 'Itaú'

  function emptyForm() {
    return {
      valor: '',
      descricao: '',
      data: new Date().toISOString().split('T')[0],
      categoria: CATEGORIAS_DESPESA[0],
      origem: 'marina',
    }
  }

  function resetModal() { setForm(emptyForm()); setModal(false) }

  async function handleAdd(e) {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return
    try {
      await addGasto({
        valor,
        descricao: form.descricao,
        data: form.data,
        categoria: form.categoria,
        origem: form.origem,
      })
      resetModal()
    } catch (err) {
      console.error(err)
    }
  }

  const filtrarPeriodo = (ls) => {
    if (!dateRange?.from || !dateRange?.to) return ls
    return ls.filter(g => {
      const d = new Date(g.data + 'T12:00:00')
      return d >= dateRange.from && d <= dateRange.to
    })
  }

  const gastosFiltrados = filtrarPeriodo(gastos)
  const pct = limite > 0 ? Math.min((totalGasto / limite) * 100, 100) : 0

  return (
    <div>
      <PageHeader title="Cartão de Crédito" />

      <div className="px-4 md:px-0 pb-28 md:pb-0 space-y-4">
        {/* Card resumo */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-text-muted">
              <CreditCard size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">
                Cartão {bancoCartao}
              </span>
            </div>
            <MonthSelector value={faturaRef} onChange={v => { setFaturaRef(v); setDateRange(undefined) }} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-text-muted mb-0.5">Limite</p>
              <p className="font-mono text-sm font-bold text-text-primary">{formatCurrency(limite)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted mb-0.5">Gasto</p>
              <p className="font-mono text-sm font-bold text-warning">{formatCurrency(totalGasto)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted mb-0.5">Disponível</p>
              <p className={`font-mono text-sm font-bold ${disponivel >= 0 ? 'text-green-deep' : 'text-danger'}`}>
                {formatCurrency(disponivel)}
              </p>
            </div>
          </div>

          <div>
            <div className="h-2 bg-cream-dark rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500
                  ${pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-green-soft'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-text-muted mt-1 text-right">{pct.toFixed(0)}% utilizado</p>
          </div>

          {melhorDiaCompra && (
            <div className="flex items-center gap-2 text-xs text-text-muted bg-cream rounded-lg px-3 py-2">
              <span>Melhor dia de compra:</span>
              <span className="font-mono font-semibold text-green-deep">dia {melhorDiaCompra}</span>
            </div>
          )}

          <div className="flex justify-end">
            <DateRangePicker
              range={dateRange}
              onRangeChange={setDateRange}
              onClear={() => setDateRange(undefined)}
            />
          </div>
        </Card>

        {/* Lista de gastos */}
        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-2">Gastos da fatura</h2>

          {isLoading ? (
            <div className="text-center py-10 text-text-muted text-sm">Carregando...</div>
          ) : gastosFiltrados.length === 0 ? (
            <div className="text-center py-10 text-text-muted text-sm">
              Nenhum gasto no período
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {gastosFiltrados.map(g => (
                <div key={g.id} className="bg-surface rounded-xl shadow-card px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 text-warning flex items-center justify-center flex-shrink-0">
                    <CategoryIcon categoria={g.categoria} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{g.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-muted">{formatDate(g.data)}</span>
                      {g.categoria && (
                        <span className="text-[10px] text-text-muted bg-cream px-1.5 py-0.5 rounded">
                          {g.categoria}
                        </span>
                      )}
                      {g.origem === 'ajuda_de_custo' && (
                        <span className="text-[10px] text-green-deep bg-green-pale px-1.5 py-0.5 rounded">
                          💼 Ajuda
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-danger">
                      -{formatCurrency(Number(g.valor))}
                    </span>
                    <button
                      onClick={() => setEditTarget(g)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-green-deep hover:bg-green-pale transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(g.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <FAB onClick={() => setModal(true)} />

      <Modal open={modal} onClose={resetModal} title="Registrar Gasto no Cartão">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <Input
            label="Valor (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            value={form.valor}
            onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
            required
          />
          <Input
            label="Descrição"
            placeholder="Ex: Netflix, Supermercado..."
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            required
          />
          <Input
            label="Data"
            type="date"
            value={form.data}
            onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
            required
          />
          <Select
            label="Categoria"
            value={form.categoria}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
          >
            {CATEGORIAS_DESPESA.map(c => <option key={c}>{c}</option>)}
          </Select>
          <Select
            label="Origem do recurso"
            value={form.origem}
            onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
          >
            <option value="marina">👩 Marina</option>
            <option value="ajuda_de_custo">💼 Ajuda de custo</option>
          </Select>
          <div className="flex gap-3 mt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={resetModal}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={isAdding}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await deleteGasto(deleteTarget); setDeleteTarget(null) }}
        message="Deseja excluir este gasto? Esta ação não pode ser desfeita."
      />

      <EditGastoCartaoModal
        open={!!editTarget}
        gasto={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => showSuccess('Lançamento atualizado')}
        onError={() => showError('Não foi possível salvar. Tente novamente.')}
      />
      <Toast {...toast} onHide={hideToast} />
    </div>
  )
}
