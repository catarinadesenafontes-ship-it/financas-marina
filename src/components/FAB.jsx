import { Plus } from 'lucide-react'

export function FAB({ onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-24 right-5 md:bottom-8 md:right-8
        w-14 h-14 rounded-full bg-green-deep text-white
        flex items-center justify-center shadow-fab
        hover:bg-green-mid active:scale-95 transition-all z-40
        ${className}
      `}
    >
      <Plus size={24} />
    </button>
  )
}
