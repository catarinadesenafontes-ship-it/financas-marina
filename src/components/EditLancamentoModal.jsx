import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useContas } from '../hooks/useContas'
import { Modal } from './Modal'
import { Input, Select } from './Input'
import { Button } from './Button'
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '../utils/categorias'

const FORMAS_PAGAMENTO = ['Pix', 'Espécie', 'Débito em conta']

export function EditLancamentoModal({ open, onClose, lancamento, onSuccess, onError }) {
  const { contas } = useContas()
  const qc = useQueryClient()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!lancamento) return
    setForm({
      data: lancamento.data ?? '',
      descricao: lancamento.descricao ?? '',
      tipo: lancamento.tipo ?? 'saida',
      valor: String(lancamento.valor ?? ''),
      categoria: lancamento.categoria ?? CATEGORIAS_DESPESA[0],
      forma_pagamento: lancamento.forma_pagamento ?? 'Pix',
      banco: lancamento.contas?.nome ?? 'Itaú',
      origem: lancamento.origem ?? 'marina',
    })
  }, [lancamento])

  async function handleSave(e) {
    e.preventDefault()
    if (!form || !lancamento) return
    const valor = parseFloat(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0) return

    setSaving(true)
    try {
      if (lancamento.tipo === 'transferencia') {
        const updates = { data: form.data, descricao: form.descricao, valor }
        const ps = [
          supabase.from('lancamentos_cc').update(updates).eq('id', lancamento.id),
        ]
        if (lancamento.transferencia_par_id) {
          ps.push(supabase.from('lancamentos_cc').update(updates).eq('id', lancamento.transferencia_par_id))
        }
        const results = await Promise.all(ps)
        const errResult = results.find(r => r.error)
        if (errResult?.error) throw errResult.error
      } else {
        const contaSelecionada = contas.find(c => c.nome === form.banco)
        const payload = {
          data: form.data,
          descricao: form.descricao,
          tipo: form.tipo,
          valor,
          categoria: form.categoria || null,
          forma_pagamento: form.tipo === 'saida' ? form.forma_pagamento : null,
          conta_id: contaSelecionada?.id ?? lancamento.conta_id,
          origem: form.origem,
        }
        const { error } = await supabase.from('lancamentos_cc').update(payload).eq('id', lancamento.id)
        if (error) throw error
      }

      qc.invalidateQueries({ queryKey: ['lancamentos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['mesada_ajuda'] })
      qc.invalidateQueries({ queryKey: ['insights'] })
      qc.invalidateQueries({ queryKey: ['relatorio_cc'] })
      qc.invalidateQueries({ queryKey: ['dashboard_6m'] })
      qc.invalidateQueries({ queryKey: ['saldo_cc'] })
      qc.invalidateQueries({ queryKey: ['saldo_mesada'] })

      onSuccess()
      onClose()
    } catch {
      onError()
    } finally {
      setSaving(false)
    }
  }

  if (!form) return null

  const isTransfer = lancamento?.tipo === 'transferencia'
  const cats = form.tipo === 'entrada' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA

  return (
    <Modal open={open} onClose={onClose} title="Editar lançamento">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {isTransfer && (
          <div className="bg-cream rounded-xl px-4 py-2 text-xs text-text-muted">
            Transferência — somente data, descrição e valor são editáveis.
          </div>
        )}

        {!isTransfer && (
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
          </Select>
        )}

        <Input
          label="Valor (R$)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          value={form.valor}
          onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
          required
        />

        <Input
          label="Descrição"
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

        {!isTransfer && (
          <>
            {form.tipo === 'saida' && (
              <Select
                label="Como foi pago?"
                value={form.forma_pagamento}
                onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
              >
                {FORMAS_PAGAMENTO.map(fp => <option key={fp}>{fp}</option>)}
              </Select>
            )}

            <Select
              label="Banco"
              value={form.banco}
              onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
            >
              <option>Inter</option>
              <option>Itaú</option>
            </Select>

            <Select
              label="Categoria"
              value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            >
              {cats.map(c => <option key={c}>{c}</option>)}
            </Select>

            <Select
              label="Origem do recurso"
              value={form.origem}
              onChange={e => setForm(f => ({ ...f, origem: e.target.value }))}
            >
              <option value="marina">👩 Marina</option>
              <option value="ajuda_de_custo">💼 Ajuda de custo</option>
            </Select>
          </>
        )}

        <div className="flex gap-3 mt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
