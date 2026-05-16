import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Landmark, CreditCard, Gift, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conta-corrente', icon: Landmark, label: 'Contas' },
  { to: '/cartao', icon: CreditCard, label: 'Cartão' },
  { to: '/mesada', icon: Gift, label: 'Mesada' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
]

export function Sidebar() {
  const { signOut } = useAuth()

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-green-deep text-white fixed left-0 top-0 z-30">
      <div className="px-6 py-8">
        <h1 className="font-bold text-xl tracking-tight">Finanças Marina</h1>
        <p className="text-green-soft text-xs mt-1 font-mono">controle pessoal</p>
      </div>

      <nav className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {links.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-green-mid text-white'
                    : 'text-green-pale hover:bg-green-mid/60'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-3 pb-6">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-green-pale hover:bg-green-mid/60 transition-colors"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  )
}
