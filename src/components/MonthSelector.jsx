import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonthYear, monthOptions } from '../utils/formatDate'

export function MonthSelector({ value, onChange }) {
  const options = monthOptions(24)
  const currentIdx = options.findIndex(o => o.value === value)

  function prev() {
    if (currentIdx < options.length - 1) onChange(options[currentIdx + 1].value)
  }

  function next() {
    if (currentIdx > 0) onChange(options[currentIdx - 1].value)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        disabled={currentIdx >= options.length - 1}
        className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors disabled:opacity-30 text-text-secondary"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-medium text-text-primary min-w-[120px] text-center capitalize">
        {formatMonthYear(value)}
      </span>
      <button
        onClick={next}
        disabled={currentIdx <= 0}
        className="p-1.5 rounded-lg hover:bg-cream-dark transition-colors disabled:opacity-30 text-text-secondary"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
