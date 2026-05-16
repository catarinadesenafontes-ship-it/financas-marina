import { useState, useEffect } from 'react'
import { AlertCircle, Info } from 'lucide-react'
import { useCartao } from '../hooks/useCartao'
import { useAuth } from '../hooks/useAuth'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input, Select } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { currentMonthRef } from '../utils/formatDate'

const DEFAULTS_CARTAO = {
  banco: 'Inter',
  limite: 1700,
  dia_fechamento: 20,
  dia_vencimento: 25,
  melhor_dia_compra: 19,
}

function BancoInfo({ nome, agencia, conta, cor, shape }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-cream rounded-xl">
      <div
        className={`w-10 h-10 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg italic
          ${shape === 'square' ? 'rounded-lg' : 'rounded-full'}`}
        style={{ background: cor }}
      >
        i
      </div>
      <div className="flex-1">
        <p className="font-semibold text-text-primary text-sm">{nome}</p>
        <div className="flex gap-4 mt-1">
          <span className="text-xs text-text-muted">Ag. <span className="text-text-secondary font-mono">{agencia}</span></span>
          <span className="text-xs text-text-muted">CC <span className="text-text-secondary font-mono">{conta}</span></span>
        </div>
      </div>
    </div>
  )
}

function Tooltip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-text-muted hover:text-text-secondary"
      >
        <Info size={13} />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-green-deep text-white text-xs rounded-xl px-3 py-2 z-50 shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}

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
  const [banco, setBanco] = useState('Inter')
  const [melhorDia, setMelhorDia] = useState('')
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [configSuccess, setConfigSuccess] = useState(false)

  const cartaoNaoConfigurado = !config || !config.limite || config.limite === 0

  useEffect(() => {
    if (config) {
      // Se não configurado ainda, aplicar defaults do Inter automaticamente
      if (!config.limite || config.limite === 0) {
        setLimite(String(DEFAULTS_CARTAO.limite))
        setDiaFecha(String(DEFAULTS_CARTAO.dia_fechamento))
        setDiaVence(String(DEFAULTS_CARTAO.dia_vencimento))
        setBanco(DEFAULTS_CARTAO.banco)
        setMelhorDia(String(DEFAULTS_CARTAO.melhor_dia_compra))
        // Auto-salvar defaults
        saveConfig(DEFAULTS_CARTAO).catch(() => {})
      } else {
        setLimite(String(config.limite))
        setDiaFecha(String(config.dia_fechamento ?? ''))
        setDiaVence(String(config.dia_vencimento ?? ''))
        setBanco(config.banco ?? 'Inter')
        setMelhorDia(String(config.melhor_dia_compra ?? ''))
      }
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
        melhor_dia_compra: parseInt(melhorDia) || 19,
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

        {/* Minhas Contas */}
        <Card>
          <h2 className="font-semibold text-text-primary mb-4">Minhas Contas</h2>
          <div className="flex flex-col gap-3">
            <BancoInfo nome="Itaú" agencia="5435" conta="50742-0" cor="#EC7000" shape="square" />
            <BancoInfo nome="Inter" agencia="0001" conta="8208716-4" cor="#FF6600" shape="circle" />
          </div>
        </Card>

        {/* Aviso se cartão não configurado */}
        {cartaoNaoConfigurado && (
          <div className="flex gap-3 bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
            <AlertCircle size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Configure o cartão antes de usar</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Os valores do Cartão Inter foram pré-preenchidos. Confirme e salve para ativar.
              </p>
            </div>
          </div>
        )}

        {/* Cartão */}
        <Card>
          <h2 className="font-semibold text-text-primary mb-4">Cartão de Crédito</h2>
          <form onSubmit={handleConfig} className="flex flex-col gap-4">
            <Select label="Banco do cartão" value={banco} onChange={e => setBanco(e.target.value)}>
              <option>Itaú</option>
              <option>Inter</option>
            </Select>

            <Input
              label="Limite total (R$)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="Ex: 1700"
              value={limite}
              onChange={e => setLimite(e.target.value)}
            />

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Dia fechamento"
                type="number"
                min="1"
                max="31"
                placeholder="20"
                value={diaFecha}
                onChange={e => setDiaFecha(e.target.value)}
              />
              <Input
                label="Dia vencimento"
                type="number"
                min="1"
                max="31"
                placeholder="25"
                value={diaVence}
                onChange={e => setDiaVence(e.target.value)}
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide flex items-center">
                  Melhor dia
                  <Tooltip text="Compras feitas até este dia entram na fatura atual. Após este dia, entram na próxima fatura." />
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="19"
                  value={melhorDia}
                  onChange={e => setMelhorDia(e.target.value)}
                  className="w-full rounded-xl bg-cream border border-cream-dark px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-green-deep transition-colors"
                />
              </div>
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
              <div className="text-xs text-danger bg-red-50 border border-red-200 rounded-xl px-4 py-3">{senhaError}</div>
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
