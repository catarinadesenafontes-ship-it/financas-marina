import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Landmark, CreditCard, Gift, PieChart } from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
  { to: '/conta-corrente', icon: Landmark, label: 'Contas' },
  { to: '/cartao', icon: CreditCard, label: 'Cartão' },
  { to: '/mesada', icon: Gift, label: 'Mesada' },
  { to: '/relatorio', icon: PieChart, label: 'Relatório' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-cream-dark md:hidden">
      <ul className="flex">
        {links.map(({ to, icon: Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[9px] font-medium transition-colors
                ${isActive ? 'text-green-deep' : 'text-text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
