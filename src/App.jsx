import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Sidebar } from './components/Sidebar'
import { BottomNav } from './components/BottomNav'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ContaCorrente } from './pages/ContaCorrente'
import { Cartao } from './pages/Cartao'
import { Mesada } from './pages/Mesada'
import { Configuracoes } from './pages/Configuracoes'
import { Relatorio } from './pages/Relatorio'
import { Insights } from './pages/Insights'

function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-green-deep border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <main className="md:ml-60 min-h-screen">
        <div className="max-w-2xl mx-auto px-0 md:px-6 py-0 md:py-6">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

function PublicRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/" element={<Login />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/conta-corrente" element={<ContaCorrente />} />
        <Route path="/cartao" element={<Cartao />} />
        <Route path="/mesada" element={<Mesada />} />
        <Route path="/relatorio" element={<Relatorio />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
