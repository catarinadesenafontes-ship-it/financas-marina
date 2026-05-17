import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { formatMonthYear } from '../utils/formatDate'
import { useMonthRange } from '../hooks/useMonthRange'

export function MonthSelector({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selectedRef = useRef(null)
  const { months } = useMonthRange()

  const currentIdx = months.findIndex(o => o.value === value)

  function prev() {
    if (months.length > 0 && currentIdx >= 0 && currentIdx < months.length - 1) {
      onChange(months[currentIdx + 1].value)
    } else {
      const [y, m] = value.split('-').map(Number)
      const d = new Date(y, m - 2, 1)
      onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
  }

  function next() {
    if (months.length > 0 && currentIdx > 0) {
      onChange(months[currentIdx - 1].value)
    } else {
      const [y, m] = value.split('-').map(Number)
      const d = new Date(y, m, 1)
      onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
  }

  const isPrevDisabled = months.length > 0 && currentIdx >= months.length - 1
  const isNextDisabled = months.length > 0 && currentIdx <= 0

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center' })
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-center gap-1">
        <button
          onClick={prev}
          disabled={isPrevDisabled}
          className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors disabled:opacity-30 text-text-secondary"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-cream-dark transition-colors"
        >
          <span className="text-sm font-medium text-text-primary min-w-[120px] text-center capitalize">
            {formatMonthYear(value)}
          </span>
          <ChevronDown size={13} className={`text-text-muted transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={next}
          disabled={isNextDisabled}
          className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors disabled:opacity-30 text-text-secondary"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {open && months.length > 0 && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface rounded-2xl shadow-xl border border-cream-dark w-52 max-h-72 overflow-y-auto">
          {months.map(m => (
            <button
              key={m.value}
              ref={m.value === value ? selectedRef : null}
              onClick={() => { onChange(m.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors first:rounded-t-2xl last:rounded-b-2xl capitalize
                ${m.value === value
                  ? 'text-green-deep font-semibold bg-green-pale'
                  : 'text-text-primary hover:bg-cream'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
