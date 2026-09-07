// Leitor do extrato do Inter em CSV.
//
// CSV é melhor que PDF aqui em tudo: valor e data já vêm separados, não passa
// por interpretação nenhuma (nem IA, nem custo), e o arquivo traz uma coluna de
// saldo corrido que permite PROVAR que nada se perdeu na leitura.
//
// Formato:
//    Extrato Conta Corrente
//   Conta ;82087164
//   Período ;01/05/2026 a 07/09/2026
//   Saldo ;564,24
//
//   Data Lançamento;Histórico;Descrição;Valor;Saldo
//   06/09/2026;Compra no débito;Supermercado Epa ...;-87,05;564,24
//
// As linhas vêm da mais nova para a mais antiga, e a coluna Saldo é o saldo
// DEPOIS daquele lançamento.

export class ExtratoInvalido extends Error {
  constructor(mensagem) {
    super(mensagem)
    this.name = 'ExtratoInvalido'
  }
}

const CABECALHO = 'Data Lançamento'

// O Inter exporta em UTF-8, mas exportador de banco não é confiável. Se o texto
// vier com acento quebrado, relê em windows-1252.
export async function lerArquivoTexto(arquivo) {
  const buffer = await arquivo.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('windows-1252').decode(buffer)
}

function paraNumero(texto) {
  const limpo = String(texto ?? '').trim().replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

function paraData(texto) {
  const m = String(texto ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

export function lerExtratoCsv(conteudo) {
  const linhas = String(conteudo).split(/\r?\n/)
  const iCabecalho = linhas.findIndex(l => l.startsWith(CABECALHO))
  if (iCabecalho === -1) {
    throw new ExtratoInvalido(
      'Não reconheci esse arquivo como um extrato do Inter em CSV. Exporte de novo escolhendo CSV.'
    )
  }

  const meta = {}
  for (const l of linhas.slice(0, iCabecalho)) {
    const [chave, valor] = l.split(';')
    if (valor !== undefined) meta[chave.trim()] = valor.trim()
  }

  const doArquivo = []
  for (const linha of linhas.slice(iCabecalho + 1)) {
    if (!linha.trim()) continue

    // Descrição pode conter ';'. Data e Histórico são os dois primeiros campos,
    // Valor e Saldo os dois últimos; o que sobra no meio é a descrição.
    const partes = linha.split(';')
    if (partes.length < 5) continue

    const data = paraData(partes[0])
    const valor = paraNumero(partes[partes.length - 2])
    const saldo = paraNumero(partes[partes.length - 1])
    if (data === null || valor === null || saldo === null) continue

    doArquivo.push({
      data,
      historico: partes[1].trim(),
      descricao: partes.slice(2, -2).join(';').replace(/\s+/g, ' ').trim(),
      valor,
      saldo,
    })
  }

  if (doArquivo.length === 0) {
    throw new ExtratoInvalido('O arquivo não tem nenhuma linha de lançamento.')
  }

  // Conferência: no arquivo (do mais novo para o mais antigo), o saldo de uma
  // linha menos o valor dela tem que dar o saldo da linha seguinte. Se fechar
  // em todas, nenhuma linha foi perdida nem lida errado.
  const furos = []
  for (let i = 0; i < doArquivo.length - 1; i++) {
    const esperado = doArquivo[i].saldo - doArquivo[i].valor
    if (Math.abs(esperado - doArquivo[i + 1].saldo) > 0.011) {
      furos.push({ linha: i + 1, data: doArquivo[i].data })
    }
  }

  const maisAntiga = doArquivo[doArquivo.length - 1]
  const saldoInicial = Number((maisAntiga.saldo - maisAntiga.valor).toFixed(2))
  const saldoFinal = doArquivo[0].saldo

  // Reverter, não ordenar por data: dentro do mesmo dia a ordem do arquivo é a
  // que faz o saldo fechar, e ordenar por data embaralharia isso.
  const linhasCronologicas = [...doArquivo].reverse()

  return {
    conta: meta['Conta'] ?? null,
    periodoTexto: meta['Período'] ?? null,
    saldoDeclarado: paraNumero(meta['Saldo']),
    saldoInicial,
    saldoFinal,
    periodo: { inicio: linhasCronologicas[0].data, fim: linhasCronologicas.at(-1).data },
    linhas: linhasCronologicas,
    // A conferência é o que dá direito de dizer "está completo".
    consistente: furos.length === 0,
    furos,
  }
}

// Categorias que dá para preencher sem adivinhação, direto do texto do banco.
const REGRAS_CATEGORIA = [
  [/pagamento\s+fatura/i, 'Fatura de cartão de crédito'],
  [/^tim\b|\btim s\.?\s?a\b/i, 'Conta TIM'],
]

function categoriaAutomatica({ historico, descricao }) {
  if (/^compra meio de transporte/i.test(historico)) return 'Transporte Urbano'
  for (const [padrao, categoria] of REGRAS_CATEGORIA) {
    if (padrao.test(descricao)) return categoria
  }
  return null
}

/**
 * Converte as linhas do extrato no formato de lancamentos_cc.
 *
 * `nomeTitular` serve para reconhecer Pix que ela manda de uma conta dela para
 * a outra: isso é transferência, não receita, e marcar como entrada inflaria o
 * saldo consolidado — o mesmo erro que a gente acabou de consertar.
 */
export function linhasExtratoCsvParaLancamentos(linhas, { contaId, indiceCategorias, nomeTitular, sugerirCategoria }) {
  const alvo = nomeTitular?.trim().toLowerCase()

  return linhas.map((linha, i) => {
    const descricao = linha.descricao || linha.historico
    const ehTransferenciaPropria =
      !!alvo && linha.valor > 0 && descricao.toLowerCase().includes(alvo)

    return {
      indice: i,
      conta_id: contaId,
      data: linha.data,
      descricao,
      historico: linha.historico,
      valor: Math.abs(linha.valor),
      tipo: linha.valor >= 0 ? 'entrada' : 'saida',
      categoria: categoriaAutomatica(linha) ?? sugerirCategoria?.(descricao, indiceCategorias) ?? null,
      origem: 'marina',
      ehTransferenciaPropria,
      saldoBanco: linha.saldo,
    }
  })
}
