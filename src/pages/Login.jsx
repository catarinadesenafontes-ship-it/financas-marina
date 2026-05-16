import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { BlobDecor } from '../components/BlobDecor'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) {
      setError('Preencha todos os campos.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      const msg = err?.message ?? ''
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('E-mail ou senha incorretos.')
      } else if (msg.includes('Email not confirmed')) {
        setError('E-mail ainda não confirmado. Verifique a caixa de entrada ou desative a confirmação no Supabase.')
      } else {
        setError(`Erro ao entrar: ${msg || 'verifique sua conexão e tente novamente.'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4 relative overflow-hidden">
      <BlobDecor className="w-[500px] h-[500px] -top-32 -right-32 opacity-70" />
      <BlobDecor className="w-[300px] h-[300px] bottom-0 -left-20 rotate-180 opacity-50" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-deep mb-4">
            <span className="text-2xl">💚</span>
          </div>
          <h1 className="font-bold text-2xl text-text-primary">Finanças Marina</h1>
          <p className="text-text-muted text-sm mt-1">Controle seu dinheiro com carinho</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl shadow-card p-6 flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="text-xs text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full mt-1">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
