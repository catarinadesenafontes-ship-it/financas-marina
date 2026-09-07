import { useState, useMemo } from 'react'
import { Upload, FileText, Check, AlertCircle, Undo2 } from 'lucide-react'
import { useImportacao } from '../hooks/useImportacao'
import { useContas } from '../hooks/useContas'
import { PdfPrecisaSenha } from '../lib/pdfTexto'
import { linhasFaturaParaGastos, linhasExtratoParaLancamentos } from '../lib/importacao'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input, Select } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { Toast, useToast } from '../components/Toast'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, currentMonthRef, monthOptions } from '../utils/formatDate'
import { CATEGORIAS_DESPESA_CARTAO, CATEGORIAS_DESPESA_CONTAS, CATEGORIAS_RECEITA } from '../utils/categorias'

const ORIGENS = [
  { value: 'marina', label: '👩 Marina' },
  { value: 'ajuda_de_custo', label: '💼 Ajuda de custo' },
]

const ROTULO_ETAPA = {
  lendo: 'Abrindo o PDF...',
  interpretando: 'Lendo os lançamentos...',
  gravando: 'Gravando...',
}

export function ImportarDocumento() {
  const { contas } = useContas()
  const { etapa, ocupado, lerDocumento, carregarIndiceCategorias, importar, desfazer } = useImportacao()
  const { toast, showSuccess, showError, hideToast } = useToast()

  const [tipo, setTipo] = useState('fatura_cartao')
  const [faturaMes, setFaturaMes] = useState(currentMonthRef)
  const [contaId, setContaId] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [senha, setSenha] = useState('')
  const [precisaSenha, setPrecisaSenha] = useState(false)
  const [erro, setErro] = useState(null)

  const [linhas, setLinhas] = useState(null) // null = ainda não leu
  const [lidoDe, setLidoDe] = useState(null)
  const [resultado, setResultado] = useState(null)

  const ehFatura = tipo === 'fatura_cartao'
  const meses = useMemo(() => monthOptions(18), [])

  const categoriasDisponiveis = ehFatura
    ? CATEGORIAS_DESPESA_CARTAO
    : [...new Set([...CATEGORIAS_DESPESA_CONTAS, ...CATEGORIAS_RECEITA])].sort()

  function reiniciar() {
    setLinhas(null)
    setLidoDe(null)
    setResultado(null)
    setArquivo(null)
    setSenha('')
    setPrecisaSenha(false)
    setErro(null)
  }

  async function handleLer(e) {
    e.preventDefault()
    if (!arquivo) return
    if (!ehFatura && !contaId) {
      setErro('Escolha a conta do extrato.')
      return
    }
    setErro(null)

    try {
      const indice = await carregarIndiceCategorias(tipo)
      const doc = await lerDocumento({ arquivo, senha, tipo })

      const preparadas = ehFatura
        ? linhasFaturaParaGastos(doc.linhas, { faturaMes, indiceCategorias: indice })
        : linhasExtratoParaLancamentos(doc.linhas, { contaId, indiceCategorias: indice })

      setLinhas(preparadas.map(l => ({ ...l, incluir: true })))
      setLidoDe(doc)
      setPrecisaSenha(false)
    } catch (e) {
      if (e instanceof PdfPrecisaSenha) {
        setPrecisaSenha(true)
        setErro(e.message + ' Normalmente são os primeiros dígitos do CPF.')
        return
      }
      setErro(e.message)
    }
  }

  function atualizarLinha(indice, campos) {
    setLinhas(ls => ls.map(l => (l.indice === indice ? { ...l, ...campos } : l)))
  }

  function aplicarEmTodasSemCategoria(categoria) {
    if (!categoria) return
    setLinhas(ls => ls.map(l => (l.categoria ? l : { ...l, categoria })))
  }

  function aplicarOrigemEmTodas(origem) {
    setLinhas(ls => ls.map(l => ({ ...l, origem })))
  }

  async function handleImportar() {
    const escolhidas = linhas.filter(l => l.incluir)
    if (escolhidas.length === 0) return

    try {
      const res = await importar({
        linhas: escolhidas,
        tipo,
        banco: lidoDe?.banco ?? (ehFatura ? null : contas.find(c => c.id === contaId)?.nome),
        contaId: ehFatura ? null : contaId,
        faturaMes: ehFatura ? faturaMes : null,
        arquivoNome: lidoDe?.arquivoNome,
        periodo: { inicio: lidoDe?.periodo_inicio ?? null, fim: lidoDe?.periodo_fim ?? null },
      })
      setResultado({ ...res, tipo })
      setLinhas(null)
      showSuccess(`${res.importados} lançamento${res.importados === 1 ? '' : 's'} importado${res.importados === 1 ? '' : 's'}`)
    } catch {
      showError('Não consegui gravar. Tente de novo.')
    }
  }

  async function handleDesfazer() {
    try {
      await desfazer({ importacaoId: resultado.importacaoId, tipo: resultado.tipo })
      showSuccess('Importação desfeita')
      reiniciar()
    } catch {
      showError('Não consegui desfazer.')
    }
  }

  const totalIncluidas = linhas?.filter(l => l.incluir).length ?? 0
  const semCategoria = linhas?.filter(l => l.incluir && !l.categoria).length ?? 0

  return (
    <div>
      <PageHeader title="Importar documento" />

      <div className="px-4 md:px-0 pb-28 md:pb-0 space-y-4">
        {/* ---------- Resultado ---------- */}
        {resultado && (
          <Card className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-pale text-green-deep flex items-center justify-center flex-shrink-0">
                <Check size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">
                  {resultado.importados} lançamento{resultado.importados === 1 ? '' : 's'} importado{resultado.importados === 1 ? '' : 's'}
                </p>
                {resultado.duplicados > 0 && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {resultado.duplicados} já estava{resultado.duplicados === 1 ? '' : 'm'} lançado{resultado.duplicados === 1 ? '' : 's'} e {resultado.duplicados === 1 ? 'foi ignorado' : 'foram ignorados'}.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={handleDesfazer}>
                <Undo2 size={14} className="inline mr-1.5" />
                Desfazer
              </Button>
              <Button className="flex-1" onClick={reiniciar}>Importar outro</Button>
            </div>
          </Card>
        )}

        {/* ---------- Upload ---------- */}
        {!linhas && !resultado && (
          <Card>
            <form onSubmit={handleLer} className="flex flex-col gap-4">
              <Select
                label="O que você vai subir?"
                value={tipo}
                onChange={e => { setTipo(e.target.value); setErro(null) }}
              >
                <option value="fatura_cartao">Fatura do cartão de crédito</option>
                <option value="extrato_cc">Extrato de conta-corrente</option>
              </Select>

              {ehFatura ? (
                <Select label="Fatura de qual mês?" value={faturaMes} onChange={e => setFaturaMes(e.target.value)}>
                  {meses.map(m => (
                    <option key={m.value} value={m.value} className="capitalize">{m.label}</option>
                  ))}
                </Select>
              ) : (
                <Select label="Conta do extrato" value={contaId} onChange={e => setContaId(e.target.value)} required>
                  <option value="">Selecione</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              )}

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Arquivo PDF</label>
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-cream-dark bg-cream cursor-pointer hover:border-green-mid transition-colors">
                  <Upload size={16} className="text-text-muted flex-shrink-0" />
                  <span className="text-sm text-text-primary truncate">
                    {arquivo ? arquivo.name : 'Escolher o PDF'}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={e => { setArquivo(e.target.files?.[0] ?? null); setErro(null) }}
                  />
                </label>
                <p className="text-[10px] text-text-muted mt-1.5">
                  O arquivo é aberto aqui no seu aparelho. Só o texto dos lançamentos é enviado para leitura.
                </p>
              </div>

              {precisaSenha && (
                <Input
                  label="Senha do PDF"
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Primeiros dígitos do CPF, normalmente"
                />
              )}

              {erro && (
                <div className="flex items-start gap-2 text-xs text-danger bg-red-50 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <Button type="submit" loading={ocupado} disabled={!arquivo}>
                {ocupado ? ROTULO_ETAPA[etapa] : 'Ler documento'}
              </Button>
            </form>
          </Card>
        )}

        {/* ---------- Revisão ---------- */}
        {linhas && (
          <>
            <Card className="space-y-3">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-green-deep flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{lidoDe?.arquivoNome}</p>
                  <p className="text-[10px] text-text-muted">
                    {linhas.length} lançamento{linhas.length === 1 ? '' : 's'} encontrado{linhas.length === 1 ? '' : 's'}
                    {lidoDe?.total_fatura ? ` · fatura de ${formatCurrency(lidoDe.total_fatura)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1 border-t border-cream-dark">
                <p className="text-[10px] text-text-muted uppercase tracking-wide pt-2">Preencher de uma vez</p>
                <div className="flex gap-2">
                  <select
                    defaultValue=""
                    onChange={e => { aplicarEmTodasSemCategoria(e.target.value); e.target.value = '' }}
                    className="flex-1 text-xs bg-cream border border-cream-dark rounded-lg px-2 py-2 text-text-primary cursor-pointer"
                  >
                    <option value="">Categoria para as que estão sem...</option>
                    {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) aplicarOrigemEmTodas(e.target.value); e.target.value = '' }}
                    className="flex-1 text-xs bg-cream border border-cream-dark rounded-lg px-2 py-2 text-text-primary cursor-pointer"
                  >
                    <option value="">Origem para todas...</option>
                    {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            <div className="flex flex-col gap-2">
              {linhas.map(linha => (
                <LinhaRevisao
                  key={linha.indice}
                  linha={linha}
                  categorias={categoriasDisponiveis}
                  onChange={campos => atualizarLinha(linha.indice, campos)}
                />
              ))}
            </div>

            <Card className="sticky bottom-24 md:bottom-4 space-y-2">
              {semCategoria > 0 && (
                <p className="text-[11px] text-text-muted">
                  {semCategoria} sem categoria — dá para importar assim e ajustar depois.
                </p>
              )}
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={reiniciar}>Cancelar</Button>
                <Button className="flex-1" loading={ocupado} disabled={totalIncluidas === 0} onClick={handleImportar}>
                  Importar {totalIncluidas}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>

      <Toast {...toast} onHide={hideToast} />
    </div>
  )
}

function LinhaRevisao({ linha, categorias, onChange }) {
  const ehEstorno = linha.tipo_original === 'estorno'
  const ehEntrada = linha.tipo === 'entrada'
  const positivo = ehEstorno || ehEntrada

  return (
    <div className={`bg-surface rounded-xl shadow-card px-4 py-3 transition-opacity ${linha.incluir ? '' : 'opacity-40'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={linha.incluir}
          onChange={e => onChange({ incluir: e.target.checked })}
          className="mt-1 w-4 h-4 accent-green-deep flex-shrink-0 cursor-pointer"
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{linha.descricao}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-text-muted">{formatDate(linha.data)}</span>
            {ehEstorno && (
              <span className="text-[10px] text-green-deep bg-green-pale px-1.5 py-0.5 rounded">estorno</span>
            )}
            {linha.tipo_original === 'encargo' && (
              <span className="text-[10px] text-warning bg-orange-50 px-1.5 py-0.5 rounded">encargo</span>
            )}
          </div>
        </div>

        <span className={`font-mono text-sm font-semibold flex-shrink-0 ${positivo ? 'text-green-deep' : 'text-danger'}`}>
          {positivo ? '+' : '-'}{formatCurrency(Math.abs(Number(linha.valor)))}
        </span>
      </div>

      {linha.incluir && (
        <div className="flex gap-2 mt-2.5 pl-7">
          <select
            value={linha.categoria ?? ''}
            onChange={e => onChange({ categoria: e.target.value || null })}
            className={`flex-1 text-xs border rounded-lg px-2 py-1.5 cursor-pointer
              ${linha.categoria
                ? 'bg-cream border-cream-dark text-text-primary'
                : 'bg-orange-50 border-orange-200 text-text-muted'}`}
          >
            <option value="">Sem categoria</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={linha.origem}
            onChange={e => onChange({ origem: e.target.value })}
            className="text-xs bg-cream border border-cream-dark rounded-lg px-2 py-1.5 text-text-primary cursor-pointer"
          >
            {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
