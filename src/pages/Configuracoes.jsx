import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { useCartao } from '../hooks/useCartao'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input, Select } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { currentMonthRef } from '../utils/formatDate'

export function Configuracoes() {
  const { updatePassword } = useAuth()
  const { config, saveConfig } = useCartao(currentMonthRef())

  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirm, setsenhaConfirm] = useState('')
  const [senhaError, setSenhaError] = useState('')
  const [senhaSuccess, setSenhaSuccess] = useState(false)
  const [loadingSenha, setLoadingSenha] = useState(false)

  const [limite, setLimite] = useState('')
  const [diaFecha, setDiaFecha] = useState('')
  const [diaVence, setDiaVence] = useState('')
  const [banco, setBanco] = useState('Itaú')
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [configSuccess, setConfigSuccess] = useState(false)

  const cartaoNaoConfigurado = !config || !config.limite || config.limite === 0

  useEffect(() => {
    if (config) {
      setLimite(String(config.limite ?? ''))
      setDiaFecha(String(config.dia_fechamento ?? ''))
      setDiaVence(String(config.dia_vencimento ?? ''))
      setBanco(config.banco ?? 'Itaú')
    }
  }, [config])

  async function handleSenha(e) {
    e.preventDefault()
    setSenhaError('')
    setSenhaSuccess(false)
    if (senhaNova.length < 6) { setSenhaError('A senha deve ter ao menos 6 caracteres.'); return }
    if (senhaNova !== senhaConfirm) { setSenhaError('As senhas não coincidem.'); return }
    setLoadingSenha(true)
    try {
      await updatePassword(senhaNova)
      setSenhaSuccess(true)
      setSenhaNova('')
      setsenhaConfirm('')
    } catch {
      setSenhaError('Erro ao atualizar a senha.')
    } finally {
      setLoadingSenha(false)
    }
  }

  async function handleConfig(e) {
    e.preventDefault()
    setLoadingConfig(true)
    setConfigSuccess(false)
    try {
      await saveConfig({
        limite: parseFloat(limite) || 0,
        dia_fechamento: parseInt(diaFecha) || 1,
        dia_vencimento: parseInt(diaVence) || 10,
        banco,
      })
      setConfigSuccess(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingConfig(false)
    }
  }

  return (
    <div>
      <PageHeader title="Configurações" />

      <div className="px-4 md:px-0 pb-28 md:pb-0 space-y-5">
        {/* Aviso se cartão não configurado */}
        {cartaoNaoConfigurado && (
          <div className="flex gap-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
            <AlertCircle size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Configure o cartão antes de usar</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Defina o limite, banco vinculado e as datas de fechamento e vencimento para usar a aba Cartão corretamente.
              </p>
            </div>
          </div>
        )}

        {/* Cartão */}
        <Card>
          <h2 className="font-semibold text-text-primary mb-4">Cartão de Crédito</h2>
          <form onSubmit={handleConfig} className="flex flex-col gap-4">
            <Select
              label="Banco do cartão"
              value={banco}
              onChange={e => setBanco(e.target.value)}
            >
              <option>Itaú</option>
              <option>Inter</option>
            </Select>
            <Input
              label="Limite total (R$)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="Ex: 3000"
              value={limite}
              onChange={e => setLimite(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Dia de fechamento"
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 25"
                value={diaFecha}
                onChange={e => setDiaFecha(e.target.value)}
              />
              <Input
                label="Dia de vencimento"
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 10"
                value={diaVence}
                onChange={e => setDiaVence(e.target.value)}
              />
            </div>

            {configSuccess && (
              <div className="text-xs text-green-deep bg-green-pale border border-green-soft rounded-xl px-4 py-3">
                Configurações salvas com sucesso!
              </div>
            )}

            <Button type="submit" loading={loadingConfig} className="w-full">
              Salvar configurações
            </Button>
          </form>
        </Card>

        {/* Senha */}
        <Card>
          <h2 className="font-semibold text-text-primary mb-4">Trocar Senha</h2>
          <form onSubmit={handleSenha} className="flex flex-col gap-4">
            <Input
              label="Nova senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={senhaNova}
              onChange={e => setSenhaNova(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              placeholder="Repita a senha"
              value={senhaConfirm}
              onChange={e => setsenhaConfirm(e.target.value)}
              autoComplete="new-password"
            />

            {senhaError && (
              <div className="text-xs text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {senhaError}
              </div>
            )}
            {senhaSuccess && (
              <div className="text-xs text-green-deep bg-green-pale border border-green-soft rounded-xl px-4 py-3">
                Senha atualizada com sucesso!
              </div>
            )}

            <Button type="submit" loading={loadingSenha} className="w-full">
              Atualizar senha
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
