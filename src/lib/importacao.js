// Regras de importação que não dependem de tela nem de banco de dados.

export function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acento
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chave que identifica uma linha dentro do documento.
 *
 * A ocorrência no fim existe porque dois Ubers de R$ 12,90 no mesmo dia são
 * dois gastos de verdade. Sem ela, o segundo seria tratado como cópia do
 * primeiro e sumiria. Subindo a mesma fatura de novo, as ocorrências caem na
 * mesma ordem e aí sim a linha é reconhecida como repetida.
 */
export function montarChavesDedup(linhas) {
  const vistos = new Map()
  return linhas.map(linha => {
    const base = [
      linha.data,
      Math.abs(Number(linha.valor)).toFixed(2),
      normalizarTexto(linha.descricao),
    ].join('|')
    const ocorrencia = (vistos.get(base) ?? 0) + 1
    vistos.set(base, ocorrencia)
    return `${base}|${ocorrencia}`
  })
}

// Ruído que os bancos grudam na frente do nome do estabelecimento. Vem
// empilhado ("COMPRA CARTAO UBER *TRIP"), por isso é removido em laço — tirar
// só o primeiro deixaria "CARTAO" no lugar do nome da loja.
const PREFIXOS_RUIDO = /^(COMPRA|CARTAO|DEBITO|CREDITO|PAG|PAGTO|PAGAMENTO|COMPR|TARIFA|PIX|TED|DOC)\b[\s*-]*/

function tirarRuido(texto) {
  let anterior
  let atual = texto
  do {
    anterior = atual
    atual = atual.replace(PREFIXOS_RUIDO, '')
  } while (atual !== anterior)
  return atual
}

/**
 * Reduz a descrição ao nome do estabelecimento, para reconhecer que
 * "IFOOD *IFOOD COM AGENCIA" e "IFOOD *IFOOD 2831" são o mesmo lugar.
 */
export function chaveComerciante(descricao) {
  const limpo = tirarRuido(normalizarTexto(descricao)).replace(/[*#]/g, ' ')

  const tokens = limpo
    .split(' ')
    .filter(t => t.length >= 3 && !/^\d+$/.test(t)) // descarta números soltos

  return tokens.slice(0, 2).join(' ') || limpo
}

/**
 * Monta o índice "estabelecimento → categoria que ela mais usou" a partir do
 * que já está lançado. É assim que a importação chega com a categoria sugerida
 * em vez de vazia.
 */
export function indexarCategorias(lancamentosAnteriores = []) {
  const contagem = new Map()

  for (const l of lancamentosAnteriores) {
    if (!l?.categoria || !l?.descricao) continue
    const chave = chaveComerciante(l.descricao)
    if (!chave) continue

    if (!contagem.has(chave)) contagem.set(chave, new Map())
    const porCategoria = contagem.get(chave)
    porCategoria.set(l.categoria, (porCategoria.get(l.categoria) ?? 0) + 1)
  }

  const indice = new Map()
  for (const [chave, porCategoria] of contagem) {
    const [categoria] = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0]
    indice.set(chave, categoria)
  }
  return indice
}

export function sugerirCategoria(descricao, indice) {
  if (!indice || indice.size === 0) return null
  const chave = chaveComerciante(descricao)
  if (!chave) return null
  if (indice.has(chave)) return indice.get(chave)

  // "IFOOD RESTAURANTE" não bate exato com "IFOOD", mas é o mesmo lugar.
  const primeiroToken = chave.split(' ')[0]
  return indice.get(primeiroToken) ?? null
}

/**
 * Converte as linhas lidas da fatura no formato de gastos_cartao.
 *
 * Pagamento da fatura anterior fica de fora: ele já aparece como saída na
 * conta-corrente, e contar aqui também dobraria o gasto — o mesmo problema
 * que a categoria "Fatura de cartão de crédito" causava nas análises.
 */
export function linhasFaturaParaGastos(linhas = [], { faturaMes, indiceCategorias }) {
  return linhas
    .filter(l => l.tipo !== 'pagamento')
    .map((linha, i) => ({
      indice: i,
      data: linha.data,
      descricao: montarDescricao(linha),
      // Estorno é dinheiro voltando: entra como valor negativo para abater a fatura.
      valor: linha.tipo === 'estorno' ? -Math.abs(linha.valor) : Math.abs(linha.valor),
      fatura_mes: faturaMes,
      categoria: sugerirCategoria(linha.descricao, indiceCategorias),
      origem: 'marina',
      tipo_original: linha.tipo,
    }))
}

export function linhasExtratoParaLancamentos(linhas = [], { contaId, indiceCategorias }) {
  return linhas.map((linha, i) => ({
    indice: i,
    conta_id: contaId,
    data: linha.data,
    descricao: linha.descricao,
    valor: Math.abs(linha.valor),
    tipo: linha.tipo === 'entrada' ? 'entrada' : 'saida',
    categoria: sugerirCategoria(linha.descricao, indiceCategorias),
    origem: 'marina',
  }))
}

function montarDescricao(linha) {
  if (linha.parcela_atual && linha.parcela_total) {
    const jaTemParcela = /\d+\s*\/\s*\d+/.test(linha.descricao)
    if (!jaTemParcela) return `${linha.descricao} (${linha.parcela_atual}/${linha.parcela_total})`
  }
  return linha.descricao
}

// A chave do grupo a que um lançamento pertence. A tela usa a mesma função para
// aplicar a categoria escolhida em todas as linhas do grupo de uma vez.
export function grupoDe(lancamento) {
  return chaveComerciante(lancamento?.descricao) || lancamento?.descricao || '(sem nome)'
}

/**
 * Agrupa os lançamentos por estabelecimento, para a revisão.
 *
 * Um extrato de quatro meses tem centenas de linhas, mas poucas dezenas de
 * lugares: no extrato real da Marina, 344 linhas viraram 105 estabelecimentos,
 * e os 20 maiores cobrem dois terços de tudo. Escolher a categoria uma vez por
 * lugar é a diferença entre 20 decisões e 344.
 */
export function agruparPorEstabelecimento(lancamentos = []) {
  const grupos = new Map()

  for (const l of lancamentos) {
    const chave = grupoDe(l)
    if (!grupos.has(chave)) {
      grupos.set(chave, { chave, rotulos: new Map(), linhas: [], categorias: new Set() })
    }
    const g = grupos.get(chave)
    g.linhas.push(l)
    g.rotulos.set(l.descricao, (g.rotulos.get(l.descricao) ?? 0) + 1)
    g.categorias.add(l.categoria ?? null)
  }

  return [...grupos.values()]
    .map(g => {
      // Rótulo do grupo: a descrição que mais aparece nele.
      const [rotulo] = [...g.rotulos.entries()].sort((a, b) => b[1] - a[1])[0]
      const categorias = [...g.categorias]
      return {
        chave: g.chave,
        rotulo,
        linhas: g.linhas,
        quantidade: g.linhas.length,
        total: g.linhas.reduce((s, l) => s + (l.tipo === 'entrada' ? 1 : -1) * Number(l.valor), 0),
        // Só herda categoria se todas as linhas do grupo concordarem.
        categoria: categorias.length === 1 ? categorias[0] : null,
        incluir: g.linhas.every(l => l.incluir !== false),
      }
    })
    .sort((a, b) => b.quantidade - a.quantidade || Math.abs(b.total) - Math.abs(a.total))
}

const TOLERANCIA_DIAS = 5

/**
 * Casa os Pix que ela mandou de uma conta sua para a outra com as
 * transferências que já estão lançadas no app, e devolve as que faltam.
 *
 * A data não bate exata: ela lança a transferência de memória, alguns dias
 * depois do movimento real (no extrato dela, 08/08 virou 10/08 e 01/07 virou
 * 28/06). Por isso o casamento é por valor, com folga na data.
 *
 * Isso importa porque transferência não pode ser importada como receita: o par
 * já existe na outra conta, e contar de novo inflaria o saldo. Mas as que nunca
 * foram lançadas precisam aparecer, senão o saldo fecha errado e ninguém sabe
 * por quê.
 */
export function casarTransferenciasProprias(doExtrato = [], jaLancadas = []) {
  const usadas = new Set()
  const faltando = []

  const distanciaEmDias = (a, b) =>
    Math.abs(new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000

  for (const linha of doExtrato) {
    const i = jaLancadas.findIndex((existente, idx) =>
      !usadas.has(idx) &&
      Math.abs(Number(existente.valor) - Number(linha.valor)) < 0.011 &&
      distanciaEmDias(existente.data, linha.data) <= TOLERANCIA_DIAS
    )
    if (i >= 0) usadas.add(i)
    else faltando.push(linha)
  }

  return {
    casadas: usadas.size,
    faltando,
    totalFaltando: faltando.reduce((s, l) => s + Number(l.valor), 0),
  }
}
