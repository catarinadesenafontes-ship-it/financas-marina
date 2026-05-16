import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirmar', message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-text-secondary mb-6">{message}</p>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="danger" className="flex-1" onClick={onConfirm} loading={loading}>
          Excluir
        </Button>
      </div>
    </Modal>
  )
}
