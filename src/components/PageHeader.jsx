import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function PageHeader({ title, showBack = false }) {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  return (
    <header className="md:hidden flex items-center justify-between px-4 pt-safe-top pb-3 bg-cream sticky top-0 z-20">
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl text-text-secondary hover:bg-cream-dark transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="font-bold text-text-primary text-lg">{title}</h1>
      </div>
      <button
        onClick={signOut}
        className="p-2 rounded-xl text-text-muted hover:bg-cream-dark transition-colors"
      >
        <LogOut size={18} />
      </button>
    </header>
  )
}
