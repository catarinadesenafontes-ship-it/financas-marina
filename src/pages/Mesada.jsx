import { useState } from 'react'
import { Trash2, Plus, Gift } from 'lucide-react'
import { useMesada } from '../hooks/useMesada'
import { useLancamentos } from '../hooks/useLancamentos'
import { useContas } from '../hooks/useContas'
import { useCartao } from '../hooks/useCartao'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { FAB } from '../components/FAB'
import { Modal } from '../components/Modal'
import { Input, Select } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { MonthSelector } from '../components/MonthSelector'
import { DateRangePicker } from '../components/DateRangePicker'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, currentMonthRef } from '../utils/formatDate'
import { CATEGORIAS_DESPESA } from '../utils/categorias'

const FORMAS_PAGAMENTO = ['Pix', 'Espécie', 'Cartão de Crédito']

export function Mesada() {
  const [mesRef, setMesRef] = useState(currentMonthRef)
  const [dateRange, setDateRange] = useState(undefined)
  const [modal, setModal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formRec, setFormRec] = useState(emptyRec())
  const [formGasto, setFormGasto] = useState(emptyGasto())

  const { recebimentos, gastos, totalRecebido, totalGasto, saldo,
    isLoading, addRecebimento, addGasto, deleteRecebimento, deleteGasto } = useMesada(mesRef)
  const { add: addLancamento } = useLancamentos(mesRef)
  const { addGasto: addGastoCartao, config: configCartao } = useCartao(currentMonthRef())
  const { contas } = useContas()

  function emptyRec() {
    return { valor: '', origem: 'mãe', banco: 'Itaú', data: new Date().toISOString().split('T')[0], observacao: '' }
  }
  function emptyGasto() {
    return {
      valor: '', descricao: '', data: new Date().toISOString().split('T')[0],
      forma_pagamento: 'Pix', banco: 'Itaú',
    }
  }

  async function handleAddRec(e) {
    e.preventDefault()
    const valor = parseFloat(formRec.valor.replace(',', '.'))
    if (!valor || valor <= 0) return

    await addRecebimento({ valor, origem: formRec.origem, data: formRec.data, observacao: formRec.observacao })

    // Cria entrada na CC (Mesada Família entra em alguma conta)
    const contaSelecionada = contas.find(c => c.nome === formRec.banco)
    if (contaSelecionada) {
      await addLancamento({
        conta_id: contaSelecionada.id,
        tipo: 'entrada',
        valor,
        descricao: `Mesada — ${formRec.origem}`,
        data: formRec.data,
        categoria: 'Mesada Família',
        forma_pagamento: null,
      })
    }

    setFormRec(emptyRec())
    setModal(null)
  }

  async function handleAddGasto(e) {
    e.preventDefault()
    const valor = parseFloat(formGasto.valor.replace(',', '.'))
    if (!valor || valor <= 0) return

    // Sempre cria o registro na mesada
    await addGasto({ valor, descricao: formGasto.descricao, data: formGasto.data })

    if (formGasto.forma_pagamento === 'Cartão de Crédito') {
      // Cria no cartão
      await addGastoCartao({ valor, descricao: formGasto.descricao, data: formGasto.data, categoria: CATEGORIAS_DESPESA[0] })
      // Cria saída na CC do banco do cartão
      const bancoCartao = configCartao?.banco ?? 'Itaú'
      const contaCartao = contas.find(c => c.nome === bancoCartao)
      if (contaCartao) {
        await addLancamento({
          conta_id: contaCartao.id,
          tipo: 'saida',
          valor,
          descricao: formGasto.descricao,
          data: formGasto.data,
          categoria: null,
          forma_pagamento: 'Cartão de Crédito',
        })
      }
    } else {
      // Pix ou Espécie: cria saída na CC selecionada
      const contaSelecionada = contas.find(c => c.nome === formGasto.banco)
      if (contaSelecionada) {
        await addLancamento({
          conta_id: contaSelecionada.id,
          tipo: 'saida',
          valor,
          descricao: formGasto.descricao,
          data: formGasto.data,
          categoria: null,
          forma_pagamento: formGasto.forma_pagamento,
        })
      }
    }

    setFormGasto(emptyGasto())
    setModal(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (deleteTarget.tipo === 'recebimento') await deleteRecebimento(deleteTarget.id)
    else await deleteGasto(deleteTarget.id)
    setDeleteTarget(null)
  }

  const filtrarPeriodo = (ls) => {
    if (!dateRange?.from || !dateRange?.to) return ls
    return ls.filter(l => {
      const d = new Date(l.data + 'T12:00:00')
      return d >= dateRange.from && d <= dateRange.to
    })
  }

  const recFiltrados = filtrarPeriodo(recebimentos)
  const gastosFiltrados = filtrarPeriodo(gastos)

  return (
    <div>
      <PageHeader title="Mesada" />

      <div className="px-4 md:px-0 pb-28 md:pb-0 space-y-4">
        {/* Filtros */}
        <div className="flex items-center justify-between">
          <MonthSelector value={mesRef} onChange={v => { setMesRef(v); setDateRange(undefined) }} />
          <DateRangePicker range={dateRange} onRangeChange={setDateRange} onClear={() => setDateRange(undefined)} />
        </div>

        {/* Card resumo */}
        <Card>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Recebido</p>
              <p className="font-mono font-bold text-green-deep text-base">{formatCurrency(totalRecebido)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Gasto</p>
              <p className="font-mono font-bold text-danger text-base">{formatCurrency(totalGasto)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Saldo</p>
              <p className={`font-mono font-bold text-base ${saldo >= 0 ? 'text-green-mid' : 'text-danger'}`}>
                {formatCurrency(saldo)}
              </p>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center py-8 text-text-muted text-sm">Carregando...</div>
        ) : (
          <>
            {/* Recebimentos */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-text-secondary">Recebimentos</h2>
                <button
                  onClick={() => setModal('recebimento')}
                  className="flex items-center gap-1 text-xs text-green-deep font-medium hover:underline"
                >
                  <Plus size={12} /> Registrar
                </button>
              </div>
              {recFiltrados.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">Nenhum recebimento no período</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {recFiltrados.map(r => (
                    <div key={r.id} className="bg-surface rounded-xl shadow-card px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-green-pale text-green-deep flex items-center justify-center">
                        <Gift size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary capitalize">{r.origem}</p>
                        <p className="text-[10px] text-text-muted">{formatDate(r.data)}</p>
                        {r.observacao && <p className="text-[10px] text-text-muted truncate">{r.observacao}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-green-deep">
                          +{formatCurrency(Number(r.valor))}
                        </span>
                        <button
                          onClick={() => setDeleteTarget({ id: r.id, tipo: 'recebimento' })}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Gastos */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-text-secondary">Como gastei</h2>
                <button
                  onClick={() => setModal('gasto')}
                  className="flex items-center gap-1 text-xs text-green-deep font-medium hover:underline"
                >
                  <Plus size={12} /> Registrar
                </button>
              </div>
              {gastosFiltrados.length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">Nenhum gasto no período</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {gastosFiltrados.map(g => (
                    <div key={g.id} className="bg-surface rounded-xl shadow-card px-4 py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-50 text-danger flex items-center justify-center text-xs font-bold">
                        R$
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{g.descricao}</p>
                        <p className="text-[10px] text-text-muted">{formatDate(g.data)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-danger">
                          -{formatCurrency(Number(g.valor))}
                        </span>
                        <button
                          onClick={() => setDeleteTarget({ id: g.id, tipo: 'gasto' })}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <FAB onClick={() => setModal('gasto')} />

      {/* Modal recebimento */}
      <Modal open={modal === 'recebimento'} onClose={() => setModal(null)} title="Registrar Recebimento">
        <form onSubmit={handleAddRec} className="flex flex-col gap-4">
          <Input
            label="Valor (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            value={formRec.valor}
            onChange={e => setFormRec(f => ({ ...f, valor: e.target.value }))}
            required
          />
          <Select
            label="Origem"
            value={formRec.origem}
            onChange={e => setFormRec(f => ({ ...f, origem: e.target.value }))}
          >
            <option value="mãe">Mãe</option>
            <option value="pai">Pai</option>
            <option value="outros">Outros</option>
          </Select>
          <Select
            label="Entrou em qual banco?"
            value={formRec.banco}
            onChange={e => setFormRec(f => ({ ...f, banco: e.target.value }))}
          >
            <option>Itaú</option>
            <option>Inter</option>
          </Select>
          <Input
            label="Data"
            type="date"
            value={formRec.data}
            onChange={e => setFormRec(f => ({ ...f, data: e.target.value }))}
            required
          />
          <Input
            label="Observação (opcional)"
            placeholder="Ex: Semana de provas"
            value={formRec.observacao}
            onChange={e => setFormRec(f => ({ ...f, observacao: e.target.value }))}
          />
          <div className="flex gap-3 mt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal gasto */}
      <Modal open={modal === 'gasto'} onClose={() => setModal(null)} title="Registrar Gasto da Mesada">
        <form onSubmit={handleAddGasto} className="flex flex-col gap-4">
          <Input
            label="Valor (R$)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            value={formGasto.valor}
            onChange={e => setFormGasto(f => ({ ...f, valor: e.target.value }))}
            required
          />
          <Input
            label="Descrição"
            placeholder="Ex: Cinema, Lanche..."
            value={formGasto.descricao}
            onChange={e => setFormGasto(f => ({ ...f, descricao: e.target.value }))}
            required
          />
          <Input
            label="Data"
            type="date"
            value={formGasto.data}
            onChange={e => setFormGasto(f => ({ ...f, data: e.target.value }))}
            required
          />
          <Select
            label="Como foi pago?"
            value={formGasto.forma_pagamento}
            onChange={e => setFormGasto(f => ({ ...f, forma_pagamento: e.target.value }))}
          >
            {FORMAS_PAGAMENTO.map(fp => <option key={fp}>{fp}</option>)}
          </Select>
          {formGasto.forma_pagamento !== 'Cartão de Crédito' && (
            <Select
              label="Banco"
              value={formGasto.banco}
              onChange={e => setFormGasto(f => ({ ...f, banco: e.target.value }))}
            >
              <option>Itaú</option>
              <option>Inter</option>
            </Select>
          )}
          <div className="flex gap-3 mt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        message="Deseja excluir este registro? Esta ação não pode ser desfeita."
      />
    </div>
  )
}
