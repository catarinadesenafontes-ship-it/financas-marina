// Leitor do extrato do Itaú.
//
// Nada a ver com o do Inter: não é separado por ';', é texto de largura fixa
// dentro de aspas, e o que diz se um número é valor ou saldo é a COLUNA onde
// ele cai. O cabeçalho da tabela dá as posições:
//
//   "data              lançamentos                    valor (R$)        saldo (R$)"
//   "29/06/2026 PIX TRANSF MARINA 28/06                  -200,00"
//   "29/06/2026 SALDO DO DIA                                            31,60"
//
// Linhas "SALDO DO DIA" não são lançamento: são o fechamento do dia, e é com
// elas que dá para conferir se o arquivo está completo.

const MARCADOR_SALDO = 'SALDO DO DIA'

export function ehExtratoItau(conteudo) {
  return /extrato conta \/ lan[çc]amentos/i.test(conteudo) || /saldo do dia/i.test(conteudo)
}

function paraNumero(texto) {
  const n = Number(String(texto).trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function paraData(texto) {
  const m = String(texto).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export function lerExtratoItau(conteudo) {
  const linhas = String(conteudo).split(/\r?\n/).map(l => l.replace(/^"|"$/g, ''))

  const iCabecalho = linhas.findIndex(l => /^\s*data\s+lan[çc]amentos/i.test(l))
  if (iCabecalho === -1) {
    throw new Error('Não reconheci esse arquivo como um extrato do Itaú. Exporte de novo em CSV.')
  }
  // Fronteiras das colunas, lidas do próprio cabeçalho: a descrição vai até
  // onde começa "valor", e número que termina depois de "saldo" é saldo.
  const cabecalhoTabela = linhas[iCabecalho].toLowerCase()
  const colunaValor = cabecalhoTabela.indexOf('valor')
  const colunaSaldo = cabecalhoTabela.indexOf('saldo')

  const cabecalho = linhas.slice(0, iCabecalho).join('\n')
  const periodoTexto = cabecalho.match(/per[íi]odo de visualiza[çc][ãa]o:\s*([\d/]+\s*at[ée]\s*[\d/]+)/i)?.[1] ?? null
  const saldoDeclarado = paraNumero(cabecalho.match(/R\$\s*([\d.]+,\d{2})/)?.[1] ?? '')
  const conta = cabecalho.match(/conta:\s*([\d-]+)/i)?.[1] ?? null

  const lancamentos = []
  const saldosDoDia = []

  for (const linha of linhas.slice(iCabecalho + 1)) {
    const data = paraData(linha.slice(0, 12))
    if (!data) continue

    const descricao = linha.slice(11, colunaValor).replace(/\s+/g, ' ').trim()

    for (const achado of linha.matchAll(/-?[\d.]+,\d{2}/g)) {
      const valor = paraNumero(achado[0])
      if (valor === null) continue
      const ehSaldo = achado.index + achado[0].length > colunaSaldo

      if (ehSaldo) saldosDoDia.push({ data, saldo: valor })
      else if (descricao) lancamentos.push({ data, historico: descricao, descricao, valor, saldo: null })
    }
  }

  if (saldosDoDia.length === 0) {
    throw new Error('O arquivo não tem nenhuma linha de saldo — não consigo conferir se está completo.')
  }

  // O arquivo vem do mais novo para o mais antigo.
  lancamentos.reverse()
  saldosDoDia.reverse()

  const saldoInicial = saldosDoDia[0].saldo
  const saldoFinal = saldosDoDia.at(-1).saldo

  // Conferência por dia: o saldo declarado no fim de cada dia tem que ser o
  // saldo anterior mais os lançamentos daquele dia. É assim que um extrato
  // exportado com o período errado se denuncia — e é o caso mais comum.
  const furos = []
  let corrente = saldoInicial
  let iLanc = 0
  for (const marco of saldosDoDia.slice(1)) {
    while (iLanc < lancamentos.length && lancamentos[iLanc].data <= marco.data) {
      corrente += lancamentos[iLanc].valor
      iLanc++
    }
    if (Math.abs(corrente - marco.saldo) > 0.011) {
      furos.push({
        data: marco.data,
        esperado: Number(corrente.toFixed(2)),
        declarado: marco.saldo,
        diferenca: Number((marco.saldo - corrente).toFixed(2)),
      })
      corrente = marco.saldo // segue a partir do que o banco diz
    }
  }

  // saldoFinal é número: o fallback tem que sair da lista de saldos, não dele.
  const primeira = lancamentos[0]?.data ?? saldosDoDia[0].data
  const ultima = lancamentos.at(-1)?.data ?? saldosDoDia.at(-1).data

  return {
    conta,
    periodoTexto,
    saldoDeclarado,
    saldoInicial,
    saldoFinal,
    // O período tem que ser o do que o arquivo REALMENTE traz, do primeiro ao
    // último lançamento. O Itaú fecha o extrato com uma linha "SALDO DO DIA" de
    // hoje mesmo quando o último lançamento é de meses atrás — usar essa data
    // faria a substituição apagar um período que o arquivo não cobre.
    periodo: { inicio: primeira, fim: ultima },
    ultimoSaldoEm: saldosDoDia.at(-1).data,
    linhas: lancamentos,
    consistente: furos.length === 0,
    furos,
  }
}
