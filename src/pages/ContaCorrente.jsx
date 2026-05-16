import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useContas } from '../hooks/useContas'
import { useLancamentos } from '../hooks/useLancamentos'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { FAB } from '../components/FAB'
import { Modal } from '../components/Modal'
import { Input, Select } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { MonthSelector } from '../components/MonthSelector'
import { CategoryIcon } from '../components/CategoryIcon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, currentMonthRef } from '../utils/formatDate'

const CATEGORIAS = ['Alimentação','Transporte','Saúde','Lazer','Educação','Moradia','Outros']
const TABS = ['Itaú', 'Inter', 'Consolidado']

export function ContaCorrente() {
  const [tab, setTab] = useState('Itaú')
  const [mesRef, setMesRef] = useState(currentMonthRef)
  const [modal, setModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm())

  const { contas, contaItau, contaInter, isLoading: loadingContas } = useContas()
  const { lancamentos, isLoading, add, remove, isAdding, isRemoving } = useLancamentos(mesRef)

  function emptyForm() {
    return {
      conta_id: '',
      tipo: 'saida',
      valor: '',
      descricao: '',
      data: new Date().toISOString().split('T')[0],
      categoria: 'Outros',
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
      } else {
        await add({
          conta_id: form.conta_id || contaItau?.id,
          tipo: form.tipo,
          valor,
          descricao: form.descricao,
          data: form.data,
          categoria: form.categoria,
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

  let visibleLanc = []
  let saldo = 0
  if (tab === 'Itaú') { visibleLanc = itauLanc; saldo = saldoConta(itauLanc) }
  else if (tab === 'Inter') { visibleLanc = interLanc; saldo = saldoConta(interLanc) }
  else { visibleLanc = [...lancamentos].sort((a, b) => b.data.localeCompare(a.data)); saldo = saldoConta(itauLanc) + saldoConta(interLanc) }

  return (
    <div className="space-y-0">
      <PageHeader title="Conta Corrente" />

      <div className="px-4 md:px-0 pb-28 md:pb-0">
        {/* Abas */}
        <div className="flex gap-1 bg-cream-dark p-1 rounded-xl mb-4">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
                ${tab === t ? 'bg-surface text-green-deep shadow-sm' : 'text-text-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Saldo + filtro */}
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Saldo do mês</p>
              <p className={`font-mono font-bold text-2xl ${saldo >= 0 ? 'text-green-deep' : 'text-danger'}`}>
                {formatCurrency(saldo)}
              </p>
            </div>
            <MonthSelector value={mesRef} onChange={setMesRef} />
          </div>
        </Card>

        {/* Lista */}
        {isLoading ? (
          <div className="text-center py-10 text-text-muted text-sm">Carregando...</div>
        ) : visibleLanc.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">
            Nenhum lançamento neste mês
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
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
          >
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
            <option value="transferencia">Transferência entre contas</option>
          </Select>

          {form.tipo !== 'transferencia' ? (
            <Select
              label="Conta"
              value={form.conta_id || contaItau?.id || ''}
              onChange={e => setForm(f => ({ ...f, conta_id: e.target.value }))}
            >
              {contas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          ) : (
            <>
              <Select
                label="De (origem)"
                value={form.contaOrigemId}
                onChange={e => setForm(f => ({ ...f, contaOrigemId: e.target.value }))}
                required
              >
                <option value="">Selecione</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Select>
              <Select
                label="Para (destino)"
                value={form.contaDestinoId}
                onChange={e => setForm(f => ({ ...f, contaDestinoId: e.target.value }))}
                required
              >
                <option value="">Selecione</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Select>
            </>
          )}

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
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
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
        onConfirm={async () => {
          await remove(deleteTarget)
          setDeleteTarget(null)
        }}
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

  return (
    <div className="bg-surface rounded-xl shadow-card px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
        ${l.tipo === 'transferencia' ? 'bg-blue-50 text-blue-500' :
          l.tipo === 'entrada' ? 'bg-green-pale text-green-deep' : 'bg-red-50 text-danger'}`}>
        <CategoryIcon
          categoria={
            l.tipo === 'transferencia' ? 'Transferência' :
            l.tipo === 'entrada' ? 'Entrada' : (l.categoria ?? 'Outros')
          }
          size={16}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{l.descricao}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-text-muted">{formatDate(l.data)}</span>
          {contaNome && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded text-white
              ${contaNome === 'Itaú' ? 'bg-itau' : 'bg-inter'}`}>
              {contaNome}
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
