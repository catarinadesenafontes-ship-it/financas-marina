import { useState, useMemo } from 'react'
import { Upload, FileText, Check, AlertCircle, AlertTriangle, Undo2 } from 'lucide-react'
import { useImportacao } from '../hooks/useImportacao'
import { useContas } from '../hooks/useContas'
import { PdfPrecisaSenha } from '../lib/pdfTexto'
import { agruparPorEstabelecimento, grupoDe } from '../lib/importacao'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input, Select } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { Toast, useToast } from '../components/Toast'
import { RevisaoPorEstabelecimento } from '../components/RevisaoPorEstabelecimento'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, currentMonthRef, monthOptions } from '../utils/formatDate'
import { CATEGORIAS_DESPESA_CARTAO, CATEGORIAS_DESPESA_CONTAS, CATEGORIAS_RECEITA } from '../utils/categorias'

const CHAVE_TITULAR = 'financas-marina:nome-titular'

const ROTULO_ETAPA = {
  lendo: 'Lendo o arquivo...',
  interpretando: 'Interpretando os lançamentos...',
  gravando: 'Gravando...',
}

function lerTitularSalvo() {
  try { return localStorage.getItem(CHAVE_TITULAR) ?? '' } catch { return '' }
}
function salvarTitular(nome) {
  try { localStorage.setItem(CHAVE_TITULAR, nome) } catch { /* modo privado, tudo bem */ }
}

export function ImportarDocumento() {
  const { contas } = useContas()
  const {
    etapa, ocupado, lerExtrato, importarExtrato, conferirSaldo,
    lerFaturaPdf, importarFatura, desfazer,
  } = useImportacao()
  const { toast, showSuccess, showError, hideToast } = useToast()

  const [modo, setModo] = useState('extrato')
  const [contaId, setContaId] = useState('')
  const [faturaMes, setFaturaMes] = useState(currentMonthRef)
  const [nomeTitular, setNomeTitular] = useState(lerTitularSalvo)
  const [arquivo, setArquivo] = useState(null)
  const [senha, setSenha] = useState('')
  const [precisaSenha, setPrecisaSenha] = useState(false)
  const [criarSaldoInicial, setCriarSaldoInicial] = useState(true)
  const [erro, setErro] = useState(null)

  const [dados, setDados] = useState(null)
  const [lancamentos, setLancamentos] = useState(null)
  const [resultado, setResultado] = useState(null)

  const ehExtrato = modo === 'extrato'
  const meses = useMemo(() => monthOptions(18), [])
  const contaEscolhida = contas.find(c => c.id === contaId)

  const categorias = ehExtrato
    ? [...new Set([...CATEGORIAS_DESPESA_CONTAS, ...CATEGORIAS_RECEITA])].sort()
    : CATEGORIAS_DESPESA_CARTAO

  const grupos = useMemo(
    () => (ehExtrato && lancamentos ? agruparPorEstabelecimento(lancamentos) : []),
    [ehExtrato, lancamentos]
  )

  function reiniciar() {
    setDados(null)
    setLancamentos(null)
    setResultado(null)
    setArquivo(null)
    setSenha(''); setPrecisaSenha(false)
    setErro(null)
  }

  async function handleLer(e) {
    e.preventDefault()
    if (!arquivo) return
    if (ehExtrato && !contaId) { setErro('Escolha de qual conta é o extrato.'); return }
    setErro(null)

    try {
      if (ehExtrato) {
        salvarTitular(nomeTitular)
        const r = await lerExtrato({ arquivo, contaId, nomeTitular })
        setDados(r)
        setCriarSaldoInicial(!r.temAnteriores)
        // Transferência entre as contas dela já existe lançada como par:
        // importar de novo como entrada contaria o mesmo dinheiro duas vezes.
        setLancamentos(r.lancamentos.map(l => ({ ...l, incluir: !l.ehTransferenciaPropria })))
      } else {
        const r = await lerFaturaPdf({ arquivo, senha, faturaMes })
        setDados(r)
        setLancamentos(r.lancamentos.map(l => ({ ...l, incluir: true })))
        setPrecisaSenha(false)
      }
    } catch (e) {
      if (e instanceof PdfPrecisaSenha) {
        setPrecisaSenha(true)
        setErro(e.message + ' Normalmente são os primeiros dígitos do CPF.')
        return
      }
      setErro(e.message)
    }
  }

  function definirCategoriaDoGrupo(chave, categoria) {
    setLancamentos(ls => ls.map(l => (grupoDe(l) === chave ? { ...l, categoria } : l)))
  }
  function definirInclusaoDoGrupo(chave, incluir) {
    setLancamentos(ls => ls.map(l => (grupoDe(l) === chave ? { ...l, incluir } : l)))
  }
  function atualizarLinha(indice, campos) {
    setLancamentos(ls => ls.map(l => (l.indice === indice ? { ...l, ...campos } : l)))
  }

  async function handleImportar() {
    try {
      if (ehExtrato) {
        const r = await importarExtrato({
          lancamentos, extrato: dados.extrato, contaId,
          banco: contaEscolhida?.nome, arquivoNome: dados.arquivoNome, criarSaldoInicial,
        })
        const conferencia = await conferirSaldo({ contaId, extrato: dados.extrato })
        setResultado({ ...r, ...conferencia, tipo: 'extrato_cc' })
      } else {
        const r = await importarFatura({
          lancamentos, faturaMes, arquivoNome: dados.arquivoNome, banco: dados.banco,
        })
        setResultado({ ...r, tipo: 'fatura_cartao' })
      }
      setLancamentos(null)
      showSuccess('Importação concluída')
    } catch (e) {
      showError(e.message ?? 'Não consegui gravar. Tente de novo.')
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

  const incluidas = lancamentos?.filter(l => l.incluir).length ?? 0
  const semCategoria = lancamentos?.filter(l => l.incluir && !l.categoria).length ?? 0

  return (
    <div>
      <PageHeader title="Importar" />

      <div className="px-4 md:px-0 pb-28 md:pb-0 space-y-4">
        {resultado && <CardResultado resultado={resultado} onDesfazer={handleDesfazer} onNovo={reiniciar} />}

        {!lancamentos && !resultado && (
          <Card>
            <form onSubmit={handleLer} className="flex flex-col gap-4">
              <Select label="O que você vai subir?" value={modo} onChange={e => { setModo(e.target.value); setErro(null); setArquivo(null) }}>
                <option value="extrato">Extrato de conta-corrente (CSV)</option>
                <option value="fatura">Fatura do cartão (PDF)</option>
              </Select>

              {ehExtrato ? (
                <>
                  <Select label="De qual conta?" value={contaId} onChange={e => setContaId(e.target.value)} required>
                    <option value="">Selecione</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </Select>
                  <Input
                    label="Seu nome como aparece nos Pix entre suas contas"
                    placeholder="Ex: Marina Fontes Moreira"
                    value={nomeTitular}
                    onChange={e => setNomeTitular(e.target.value)}
                  />
                  <p className="text-[10px] text-text-muted -mt-2">
                    Serve para reconhecer o dinheiro que você move de uma conta sua para a outra —
                    isso é transferência, não receita, e entraria contando dobrado.
                  </p>
                </>
              ) : (
                <Select label="Fatura de qual mês?" value={faturaMes} onChange={e => setFaturaMes(e.target.value)}>
                  {meses.map(m => <option key={m.value} value={m.value} className="capitalize">{m.label}</option>)}
                </Select>
              )}

              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wide mb-1.5">
                  Arquivo {ehExtrato ? 'CSV' : 'PDF'}
                </label>
                <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-cream-dark bg-cream cursor-pointer hover:border-green-mid transition-colors">
                  <Upload size={16} className="text-text-muted flex-shrink-0" />
                  <span className="text-sm text-text-primary truncate">
                    {arquivo ? arquivo.name : `Escolher o ${ehExtrato ? 'CSV' : 'PDF'}`}
                  </span>
                  <input
                    type="file"
                    accept={ehExtrato ? '.csv,text/csv' : 'application/pdf,.pdf'}
                    className="hidden"
                    onChange={e => { setArquivo(e.target.files?.[0] ?? null); setErro(null) }}
                  />
                </label>
                <p className="text-[10px] text-text-muted mt-1.5">
                  {ehExtrato
                    ? 'O CSV é lido aqui mesmo, sem sair do seu aparelho e sem custo nenhum.'
                    : 'O PDF é aberto no seu aparelho; só o texto é enviado para leitura.'}
                </p>
              </div>

              {precisaSenha && (
                <Input label="Senha do PDF" type="password" value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Primeiros dígitos do CPF, normalmente" />
              )}

              {erro && (
                <div className="flex items-start gap-2 text-xs text-danger bg-red-50 rounded-xl px-3 py-2.5">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <Button type="submit" loading={ocupado} disabled={!arquivo}>
                {ocupado ? ROTULO_ETAPA[etapa] : 'Ler arquivo'}
              </Button>
            </form>
          </Card>
        )}

        {lancamentos && (
          <>
            {ehExtrato
              ? <ResumoExtrato dados={dados} conta={contaEscolhida}
                  criarSaldoInicial={criarSaldoInicial} onCriarSaldoInicial={setCriarSaldoInicial} />
              : <ResumoFatura dados={dados} total={lancamentos.length} />}

            {ehExtrato ? (
              <RevisaoPorEstabelecimento
                grupos={grupos}
                categorias={categorias}
                onCategoria={definirCategoriaDoGrupo}
                onIncluir={definirInclusaoDoGrupo}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {lancamentos.map(l => (
                  <LinhaFatura key={l.indice} linha={l} categorias={categorias}
                    onChange={c => atualizarLinha(l.indice, c)} />
                ))}
              </div>
            )}

            <Card className="sticky bottom-24 md:bottom-4 space-y-2">
              {semCategoria > 0 && (
                <p className="text-[11px] text-text-muted">
                  {semCategoria} sem categoria — dá para importar assim e ajustar depois.
                </p>
              )}
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={reiniciar}>Cancelar</Button>
                <Button className="flex-1" loading={ocupado} disabled={incluidas === 0} onClick={handleImportar}>
                  Importar {incluidas}
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

function ResumoExtrato({ dados, conta, criarSaldoInicial, onCriarSaldoInicial }) {
  const { extrato, manuaisNoPeriodo, temAnteriores, arquivoNome, transferencias } = dados

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <FileText size={16} className="text-green-deep flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{arquivoNome}</p>
          <p className="text-[10px] text-text-muted">
            {extrato.linhas.length} lançamentos · {formatDate(extrato.periodo.inicio)} a {formatDate(extrato.periodo.fim)}
            {conta ? ` · ${conta.nome}` : ''}
          </p>
        </div>
      </div>

      {/* A coluna de saldo do próprio arquivo é o que permite afirmar que nada
          se perdeu na leitura — vale mostrar isso para ela. */}
      {extrato.consistente ? (
        <div className="flex items-start gap-2 text-[11px] text-green-deep bg-green-pale rounded-xl px-3 py-2.5">
          <Check size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Arquivo conferido linha a linha: saldo inicial de {formatCurrency(extrato.saldoInicial)} mais
            todo o movimento dá exatamente {formatCurrency(extrato.saldoFinal)}, o saldo que o banco declara.
          </span>
        </div>
      ) : (
        <div className="text-[11px] text-warning bg-orange-50 rounded-xl px-3 py-2.5 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>Esse arquivo está incompleto.</strong> O saldo declarado não bate com a soma
              dos lançamentos — quase sempre é período errado na exportação. Exporte de novo
              cobrindo até hoje antes de importar.
            </span>
          </div>
          <ul className="pl-5">
            {extrato.furos.slice(0, 4).map((f, i) => (
              <li key={i}>
                em {formatDate(f.data)} faltam <span className="font-mono">{formatCurrency(Math.abs(f.diferenca ?? 0))}</span>
              </li>
            ))}
          </ul>
          {extrato.periodoTexto && (
            <p className="pl-5 text-text-muted">O arquivo diz cobrir: {extrato.periodoTexto}</p>
          )}
        </div>
      )}

      {manuaisNoPeriodo > 0 && (
        <div className="flex items-start gap-2 text-[11px] text-warning bg-orange-50 rounded-xl px-3 py-2.5">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>{manuaisNoPeriodo}</strong> lançamento{manuaisNoPeriodo === 1 ? '' : 's'} que você
            digitou à mão nesse período {manuaisNoPeriodo === 1 ? 'será substituído' : 'serão substituídos'} pelo
            que veio do banco. Transferências entre contas são preservadas.
          </span>
        </div>
      )}

      {transferencias?.faltando?.length > 0 && (
        <div className="text-[11px] text-warning bg-orange-50 rounded-xl px-3 py-2.5 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              O extrato mostra <strong>{transferencias.faltando.length}</strong> transferência
              {transferencias.faltando.length === 1 ? '' : 's'} entre suas contas que nunca
              {transferencias.faltando.length === 1 ? ' foi lançada' : ' foram lançadas'}, somando{' '}
              {formatCurrency(transferencias.totalFaltando)}. Elas não entram na importação — lance
              como transferência na tela de Contas, senão o saldo vai fechar errado nesse valor.
            </span>
          </div>
          <ul className="pl-5 font-mono">
            {transferencias.faltando.map((t, i) => (
              <li key={i}>{formatDate(t.data)} — {formatCurrency(t.valor)}</li>
            ))}
          </ul>
        </div>
      )}

      {!temAnteriores && extrato.saldoInicial !== 0 && (
        <label className="flex items-start gap-2 text-[11px] text-text-primary bg-cream rounded-xl px-3 py-2.5 cursor-pointer">
          <input type="checkbox" checked={criarSaldoInicial}
            onChange={e => onCriarSaldoInicial(e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 accent-green-deep flex-shrink-0" />
          <span>
            Registrar o saldo de partida de {formatCurrency(extrato.saldoInicial)} que a conta já tinha
            antes desse extrato. Sem isso o saldo fica errado nesse valor.
          </span>
        </label>
      )}
    </Card>
  )
}

function ResumoFatura({ dados, total }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <FileText size={16} className="text-green-deep flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{dados?.arquivoNome}</p>
          <p className="text-[10px] text-text-muted">
            {total} lançamentos encontrados
            {dados?.total_fatura ? ` · fatura de ${formatCurrency(dados.total_fatura)}` : ''}
          </p>
        </div>
      </div>
    </Card>
  )
}

function CardResultado({ resultado, onDesfazer, onNovo }) {
  const fecha = resultado.fecha

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-green-pale text-green-deep flex items-center justify-center flex-shrink-0">
          <Check size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">
            {resultado.importados} lançamento{resultado.importados === 1 ? '' : 's'} importado{resultado.importados === 1 ? '' : 's'}
          </p>
          <div className="text-xs text-text-muted mt-0.5 space-y-0.5">
            {resultado.substituidos > 0 && <p>{resultado.substituidos} digitados à mão foram substituídos.</p>}
            {resultado.duplicados > 0 && <p>{resultado.duplicados} já existiam e foram ignorados.</p>}
          </div>
        </div>
      </div>

      {resultado.saldoBanco !== undefined && (
        <div className={`text-[11px] rounded-xl px-3 py-2.5 ${fecha ? 'text-green-deep bg-green-pale' : 'text-warning bg-orange-50'}`}>
          {fecha ? (
            <span>
              <strong>Bateu.</strong> O saldo da conta no app agora é {formatCurrency(resultado.saldoApp)},
              exatamente o que o banco mostra.
            </span>
          ) : (
            <span>
              O saldo no app ficou {formatCurrency(resultado.saldoApp)} e o banco mostra{' '}
              {formatCurrency(resultado.saldoBanco)} — diferença de {formatCurrency(Math.abs(resultado.diferenca))}.
              Costuma ser transferência entre contas que ainda não foi lançada.
            </span>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onDesfazer}>
          <Undo2 size={14} className="inline mr-1.5" />
          Desfazer
        </Button>
        <Button className="flex-1" onClick={onNovo}>Importar outro</Button>
      </div>
    </Card>
  )
}

function LinhaFatura({ linha, categorias, onChange }) {
  const positivo = linha.tipo_original === 'estorno'

  return (
    <div className={`bg-surface rounded-xl shadow-card px-4 py-3 transition-opacity ${linha.incluir ? '' : 'opacity-40'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={linha.incluir}
          onChange={e => onChange({ incluir: e.target.checked })}
          className="mt-1 w-4 h-4 accent-green-deep flex-shrink-0 cursor-pointer" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{linha.descricao}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-text-muted">{formatDate(linha.data)}</span>
            {positivo && <span className="text-[10px] text-green-deep bg-green-pale px-1.5 py-0.5 rounded">estorno</span>}
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
        <select
          value={linha.categoria ?? ''}
          onChange={e => onChange({ categoria: e.target.value || null })}
          className={`w-full text-xs border rounded-lg px-2 py-1.5 mt-2.5 ml-7 cursor-pointer
            ${linha.categoria ? 'bg-cream border-cream-dark text-text-primary' : 'bg-orange-50 border-orange-200 text-text-muted'}`}
          style={{ width: 'calc(100% - 1.75rem)' }}
        >
          <option value="">Sem categoria</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  )
}
