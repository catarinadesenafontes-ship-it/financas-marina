import { useState } from 'react'
import { Gift, Pencil, Trash2 } from 'lucide-react'
import { useMesada } from '../hooks/useMesada'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { MonthSelector } from '../components/MonthSelector'
import { CategoryIcon } from '../components/CategoryIcon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EditLancamentoModal } from '../components/EditLancamentoModal'
import { EditGastoCartaoModal } from '../components/EditGastoCartaoModal'
import { Toast, useToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, currentMonthRef } from '../utils/formatDate'

export function Mesada() {
  const [mesRef, setMesRef] = useState(currentMonthRef)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { toast, showSuccess, showError, hideToast } = useToast()

  const { allItems, totalRecebido, totalGasto, saldo, isLoading, deleteLancamento, deleteGasto } = useMesada(mesRef)

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      if (deleteTarget.isCartao) {
        await deleteGasto(deleteTarget.id)
      } else {
        await deleteLancamento(deleteTarget.id)
      }
    } catch {
      showError('Não foi possível excluir. Tente novamente.')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader title="Ajuda de Custo" />

      <div className="px-4 md:px-0 pb-28 md:pb-0 space-y-4">
        {/* Aviso */}
        <div className="flex items-start gap-2 bg-cream rounded-xl px-4 py-3 text-xs text-text-muted">
          <Gift size={13} className="flex-shrink-0 mt-0.5" />
          <span>Aqui você vê todos os lançamentos marcados como Ajuda de custo, lançados nas abas Contas e Cartão.</span>
        </div>

        {/* Filtro de mês */}
        <div className="flex justify-between items-center">
          <p className="text-xs text-text-muted uppercase tracking-wide">Mês de referência</p>
          <MonthSelector value={mesRef} onChange={setMesRef} />
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

        {/* Lista */}
        {isLoading ? (
          <div className="text-center py-8 text-text-muted text-sm">Carregando...</div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">
            Nenhum lançamento com ajuda de custo neste mês
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {allItems.map((item, i) => (
              <div key={item.id ?? i} className="bg-surface rounded-xl shadow-card px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                  ${item.isReceita ? 'bg-green-pale text-green-deep' : 'bg-red-50 text-danger'}`}>
                  <CategoryIcon categoria={item.categoria ?? (item.isReceita ? 'Entrada' : 'Saída')} size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {item.descricao ?? item.categoria ?? '—'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-text-muted">{formatDate(item.data)}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded text-white
                      ${item.fonte === 'Cartão' ? 'bg-warning' :
                        item.fonte === 'Itaú' ? 'bg-itau' : 'bg-inter'}`}>
                      {item.fonte === 'Cartão' ? 'Cartão' : `CC ${item.fonte}`}
                    </span>
                    {item.categoria && (
                      <span className="text-[10px] text-text-muted bg-cream px-1.5 py-0.5 rounded">
                        {item.categoria}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`font-mono text-sm font-semibold
                    ${item.isReceita ? 'text-green-deep' : 'text-danger'}`}>
                    {item.isReceita ? '+' : '-'}{formatCurrency(Number(item.valor))}
                  </span>
                  <button
                    onClick={() => setEditTarget(item)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-green-deep hover:bg-green-pale transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(item)}
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        message="Deseja excluir este lançamento? Esta ação não pode ser desfeita."
      />

      {editTarget && !editTarget.isCartao && (
        <EditLancamentoModal
          open={!!editTarget}
          lancamento={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => showSuccess('Lançamento atualizado')}
          onError={() => showError('Não foi possível salvar. Tente novamente.')}
        />
      )}

      {editTarget && editTarget.isCartao && (
        <EditGastoCartaoModal
          open={!!editTarget}
          gasto={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => showSuccess('Lançamento atualizado')}
          onError={() => showError('Não foi possível salvar. Tente novamente.')}
        />
      )}

      <Toast {...toast} onHide={hideToast} />
    </div>
  )
}
