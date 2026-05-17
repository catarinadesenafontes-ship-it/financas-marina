import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

export function Toast({ message, type = 'success', visible, onHide }) {
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onHide, 3000)
    return () => clearTimeout(t)
  }, [visible, message]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  return (
    <div className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100]
      flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white
      transition-all duration-300
      ${type === 'success' ? 'bg-green-deep' : 'bg-danger'}`}
    >
      {type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {message}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' })

  const showSuccess = useCallback((message) => {
    setToast({ visible: true, message, type: 'success' })
  }, [])

  const showError = useCallback((message) => {
    setToast({ visible: true, message, type: 'error' })
  }, [])

  const hideToast = useCallback(() => {
    setToast(t => ({ ...t, visible: false }))
  }, [])

  return { toast, showSuccess, showError, hideToast }
}
