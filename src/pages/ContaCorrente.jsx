import { useState, useMemo } from 'react'
import { Trash2, Layers } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useContas } from '../hooks/useContas'
import { useLancamentos } from '../hooks/useLancamentos'
import { useCartao } from '../hooks/useCartao'
import { useAuth } from '../hooks/useAuth'
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
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categorias'

const TABS = ['Itaú', 'Inter', 'Consolidado']
const FORMAS_PAGAMENTO = ['Pix', 'Espécie', 'Cartão de Crédito']

export function ContaCorrente() {
  const { user } = useAuth()
  const [tab, setTab] = useState('Itaú')
  const [mesRef, setMesRef] = useState(currentMonthRef)
  const [dateRange, setDateRange] = useState(undefined)
  const [modal, setModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm())

  const { contas, contaItau, contaInter } = useContas()
  const { lancamentos, isLoading, add, remove, isAdding, isRemoving } = useLancamentos(mesRef)
  const { addGasto: addGastoCartao, config: configCartao } = useCartao(currentMonthRef())

  function emptyForm() {
    return {
      conta_id: '',
      tipo: 'saida',
      forma_pagamento: 'Pix',
      banco: 'Itaú',
      valor: '',
      descricao: '',
      data: new Date().toISOString().split('T')[0],
      categoria: CATEGORIAS_DESPESA[0],
      contaOrigemId: '',
      contaDestinoId: '',
    }
  }

  function resetModal() { setForm(emptyForm()); setModal(false) }

  async function handleAdd(e) {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return

    try {
      if (form.tipo === 'transferencia') {
        await add({
          tipo: 'transferencia',
          contaOrigemId: form.contaOrigemId,
          contaDestinoId: form.contaDestinoId,
          valor,
          descricao: form.descricao || 'Transferência',
          data: form.data,
          categoria: null,
        })
      } else if (form.tipo === 'saida' && form.forma_pagamento === 'Cartão de Crédito') {
        // Cria o gasto no cartão
        await addGastoCartao({
          valor,
          descricao: form.descricao,
          data: form.data,
          categoria: form.categoria,
        })
        // Cria também a saída na CC vinculada ao cartão
        const bancoCartao = configCartao?.banco ?? 'Itaú'
        const contaCartao = contas.find(c => c.nome === bancoCartao)
        if (contaCartao) {
          await add({
            conta_id: contaCartao.id,
            tipo: 'saida',
            valor,
            descricao: form.descricao,
            data: form.data,
            categoria: form.categoria,
            forma_pagamento: 'Cartão de Crédito',
          })
        }
      } else {
        // Pix ou Espécie: define conta pelo banco selecionado
        const contaSelecionada = contas.find(c => c.nome === form.banco)
        await add({
          conta_id: contaSelecionada?.id || contaItau?.id,
          tipo: form.tipo,
          valor,
          descricao: form.descricao,
          data: form.data,
          categoria: form.categoria,
          forma_pagamento: form.tipo === 'saida' ? form.forma_pagamento : null,
        })
      }
      resetModal()
    } catch (err) {
      console.error(err)
    }
  }

  function lancamentosDaConta(contaId) {
    return lancamentos.filter(l => l.conta_id === contaId)
  }

  function saldoConta(ls) {
    return ls.reduce((acc, l) => {
      if (l.tipo === 'entrada') return acc + Number(l.valor)
      if (l.tipo === 'saida') return acc - Number(l.valor)
      if (l.tipo === 'transferencia') {
        const isEntrada = lancamentos.some(
          lp => lp.id === l.transferencia_par_id && lp.conta_id !== l.conta_id
        )
        return acc + (isEntrada ? Number(l.valor) : -Number(l.valor))
      }
      return acc
    }, 0)
  }

  const itauLanc = contaItau ? lancamentosDaConta(contaItau.id) : []
  const interLanc = contaInter ? lancamentosDaConta(contaInter.id) : []

  const filtrarPeriodo = (ls) => {
    if (!dateRange?.from || !dateRange?.to) return ls
    return ls.filter(l => {
      const d = new Date(l.data + 'T12:00:00')
      return d >= dateRange.from && d <= dateRange.to
    })
  }

  let allLanc = []
  let saldo = 0
  if (tab === 'Itaú') { allLanc = itauLanc; saldo = saldoConta(itauLanc) }
  else if (tab === 'Inter') { allLanc = interLanc; saldo = saldoConta(interLanc) }
  else {
    allLanc = [...lancamentos].sort((a, b) => b.data.localeCompare(a.data))
    saldo = saldoConta(itauLanc) + saldoConta(interLanc)
  }

  const visibleLanc = filtrarPeriodo(allLanc)
  const categoriasDespesa = CATEGORIAS_DESPESA
  const categoriasReceita = CATEGORIAS_RECEITA

  return (
    <div>
      <PageHeader title="Conta Corrente" />

      <div className="px-4 md:px-0 pb-28 md:pb-0">
        {/* Abas com logos dos bancos */}
        <div className="flex gap-1 bg-cream-dark p-1 rounded-xl mb-4">
          {[
            {
              key: 'Itaú',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-white font-bold italic text-xs" style={{ background: '#EC7000' }}>i</span>
                  Itaú
                </span>
              ),
            },
            {
              key: 'Inter',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold italic text-xs" style={{ background: '#FF6600' }}>i</span>
                  Inter
                </span>
              ),
            },
            {
              key: 'Consolidado',
              label: (
                <span className="flex items-center justify-center gap-1.5">
                  <Layers size={13} />
                  Consolidado
                </span>
              ),
            },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
                ${tab === key ? 'bg-surface text-green-deep shadow-sm' : 'text-text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Saldo + filtros */}
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Saldo do mês</p>
              <p className={`font-mono font-bold text-2xl ${saldo >= 0 ? 'text-green-deep' : 'text-danger'}`}>
                {formatCurrency(saldo)}
              </p>
            </div>
            <MonthSelector value={mesRef} onChange={v => { setMesRef(v); setDateRange(undefined) }} />
          </div>
          <div className="flex justify-end">
            <DateRangePicker
              range={dateRange}
              onRangeChange={setDateRange}
              onClear={() => setDateRange(undefined)}
            />
          </div>
        </Card>

        {/* Lista */}
        {isLoading ? (
          <div className="text-center py-10 text-text-muted text-sm">Carregando...</div>
        ) : visibleLanc.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">
            Nenhum lançamento no período
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleLanc.map(l => (
              <LancamentoItem
                key={l.id}
                lancamento={l}
                todoLanc={lancamentos}
                onDelete={() => setDeleteTarget(l.id)}
              />
            ))}
          </div>
        )}
      </div>

      <FAB onClick={() => setModal(true)} />

      {/* Modal novo lançamento */}
      <Modal open={modal} onClose={resetModal} title="Novo Lançamento">
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={e => setForm(f => ({
              ...f,
              tipo: e.target.value,
              categoria: e.target.value === 'entrada' ? CATEGORIAS_RECEITA[0] : CATEGORIAS_DESPESA[0],
            }))}
          >
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
            <option value="transferencia">Transferência entre contas</option>
          </Select>

          {/* Forma de pagamento (só para saída) */}
          {form.tipo === 'saida' && (
            <Select
              label="Como foi pago?"
              value={form.forma_pagamento}
              onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
            >
              {FORMAS_PAGAMENTO.map(fp => <option key={fp}>{fp}</option>)}
            </Select>
          )}

          {/* Banco — para Pix/Espécie (saída/entrada) ou transferência */}
          {form.tipo === 'transferencia' ? (
            <>
              <Select
                label="De (origem)"
                value={form.contaOrigemId}
                onChange={e => setForm(f => ({ ...f, contaOrigemId: e.target.value }))}
                required
              >
                <option value="">Selecione</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
              <Select
                label="Para (destino)"
                value={form.contaDestinoId}
                onChange={e => setForm(f => ({ ...f, contaDestinoId: e.target.value }))}
                required
              >
                <option value="">Selecione</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </>
          ) : form.tipo === 'entrada' || (form.tipo === 'saida' && form.forma_pagamento !== 'Cartão de Crédito') ? (
            <Select
              label="Banco"
              value={form.banco}
              onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
            >
              <option>Itaú</option>
              <option>Inter</option>
            </Select>
          ) : null}

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
            placeholder="Ex: Mercado, Salário..."
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

          {form.tipo !== 'transferencia' && (
            <Select
              label="Categoria"
              value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            >
              {(form.tipo === 'entrada' ? categoriasReceita : categoriasDespesa)
                .map(c => <option key={c}>{c}</option>)}
            </Select>
          )}

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
        onConfirm={async () => { await remove(deleteTarget); setDeleteTarget(null) }}
        loading={isRemoving}
        message="Deseja excluir este lançamento? Esta ação não pode ser desfeita."
      />
    </div>
  )
}

function LancamentoItem({ lancamento: l, todoLanc, onDelete }) {
  const contaNome = l.contas?.nome ?? ''
  const isEntrada = l.tipo === 'entrada' || (
    l.tipo === 'transferencia' &&
    todoLanc.some(lp => lp.id === l.transferencia_par_id && lp.conta_id !== l.conta_id)
  )
  const formaPag = l.forma_pagamento

  return (
    <div className="bg-surface rounded-xl shadow-card px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
        ${l.tipo === 'transferencia' ? 'bg-blue-50 text-blue-500' :
          l.tipo === 'entrada' ? 'bg-green-pale text-green-deep' : 'bg-red-50 text-danger'}`}>
        <CategoryIcon
          categoria={
            l.tipo === 'transferencia' ? 'Transferência' :
            l.tipo === 'entrada' ? (l.categoria ?? 'Entrada') : (l.categoria ?? 'Saída')
          }
          size={16}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{l.descricao}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] text-text-muted">{formatDate(l.data)}</span>
          {contaNome && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded text-white
              ${contaNome === 'Itaú' ? 'bg-itau' : 'bg-inter'}`}>
              {contaNome}
            </span>
          )}
          {formaPag && (
            <span className="text-[10px] text-text-muted bg-cream px-1.5 py-0.5 rounded">
              {formaPag}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`font-mono text-sm font-semibold
          ${isEntrada ? 'text-green-deep' : 'text-danger'}`}>
          {isEntrada ? '+' : '-'}{formatCurrency(Math.abs(Number(l.valor)))}
        </span>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
