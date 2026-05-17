import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'
import { Input, Select } from './Input'
import { Button } from './Button'
import { CATEGORIAS_DESPESA } from '../utils/categorias'

export function EditGastoCartaoModal({ open, onClose, gasto, onSuccess, onError }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!gasto) return
    setForm({
      data: gasto.data ?? '',
      descricao: gasto.descricao ?? '',
      valor: String(gasto.valor ?? ''),
      categoria: gasto.categoria ?? CATEGORIAS_DESPESA[0],
      origem: gasto.origem ?? 'marina',
    })
  }, [gasto])

  async function handleSave(e) {
    e.preventDefault()
    if (!form || !gasto) return
    const valor = parseFloat(String(form.valor).replace(',', '.'))
    if (!valor || valor <= 0) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('gastos_cartao')
        .update({
          data: form.data,
          descricao: form.descricao,
          valor,
          categoria: form.categoria,
          origem: form.origem,
        })
        .eq('id', gasto.id)
      if (error) throw error

      qc.invalidateQueries({ queryKey: ['gastos_cartao'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['mesada_ajuda'] })
      qc.invalidateQueries({ queryKey: ['insights'] })
      qc.invalidateQueries({ queryKey: ['relatorio_cartao'] })

      onSuccess()
      onClose()
    } catch {
      onError()
    } finally {
      setSaving(false)
    }
  }

  if (!form) return null

  return (
    <Modal open={open} onClose={onClose} title="Editar gasto no cartão">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
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
