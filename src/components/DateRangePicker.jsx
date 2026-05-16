import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { format } from 'date-fns'
import { Calendar, X } from 'lucide-react'
import 'react-day-picker/style.css'

export function DateRangePicker({ range, onRangeChange, onClear }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const hasRange = range?.from && range?.to
  const label = hasRange
    ? `${format(range.from, 'dd/MM')} – ${format(range.to, 'dd/MM')}`
    : 'Período'

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors
          ${hasRange
            ? 'bg-green-deep text-white border-green-deep'
            : 'bg-cream border-cream-dark text-text-secondary hover:border-green-deep'}`}
      >
        <Calendar size={13} />
        {label}
        {hasRange && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onClear(); setOpen(false) }}
            className="ml-0.5 hover:opacity-70"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-surface rounded-2xl shadow-xl border border-cream-dark p-2 rdp-marina">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={r => {
              onRangeChange(r)
              if (r?.from && r?.to) setOpen(false)
            }}
            locale={ptBR}
          />
        </div>
      )}
    </div>
  )
}
