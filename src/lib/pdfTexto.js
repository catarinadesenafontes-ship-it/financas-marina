// O pdf.js pesa quase meio megabyte. Como só a tela de importação precisa dele,
// ele é buscado na primeira leitura em vez de entrar no pacote que abre o app —
// a Marina usa isso no celular.
let pdfjsPromise = null

function carregarPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs
    })()
  }
  return pdfjsPromise
}

// Erro que a tela sabe tratar: pede a senha e tenta de novo.
export class PdfPrecisaSenha extends Error {
  constructor(senhaErrada = false) {
    super(senhaErrada ? 'Senha incorreta.' : 'Este PDF está protegido por senha.')
    this.name = 'PdfPrecisaSenha'
    this.senhaErrada = senhaErrada
  }
}

// pdf.js entrega pedaços soltos de texto com a posição de cada um. Jogados num
// texto corrido, a fatura vira sopa de números e o modelo perde qual valor é de
// qual compra. Aqui os pedaços voltam a virar linhas: agrupa por altura na
// página, ordena da esquerda para a direita e junta.
function reconstruirLinhas(items) {
  const TOLERANCIA_Y = 2 // mesma linha impressa varia alguns décimos de ponto
  const linhas = []

  for (const item of items) {
    const texto = item.str
    if (!texto || !texto.trim()) continue

    const x = item.transform[4]
    const y = item.transform[5]

    const linha = linhas.find(l => Math.abs(l.y - y) <= TOLERANCIA_Y)
    if (linha) {
      linha.pedacos.push({ x, texto })
    } else {
      linhas.push({ y, pedacos: [{ x, texto }] })
    }
  }

  return linhas
    .sort((a, b) => b.y - a.y) // no PDF a origem é embaixo: y maior = mais alto
    .map(linha =>
      linha.pedacos
        .sort((a, b) => a.x - b.x)
        .map(p => p.texto)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
}

/**
 * Extrai o texto de um PDF no próprio navegador. O arquivo não sai do
 * dispositivo — para a leitura, só o texto é enviado.
 *
 * Lança PdfPrecisaSenha quando o arquivo é protegido (fatura de banco quase
 * sempre é, com dígitos do CPF).
 */
export async function extrairTextoPdf(arquivo, senha = '') {
  const pdfjs = await carregarPdfjs()
  const buffer = await arquivo.arrayBuffer()

  const tarefa = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password: senha || undefined,
    // A fatura não tem fonte externa nem imagem que importe para o texto.
    disableFontFace: true,
    isEvalSupported: false,
  })

  let doc
  try {
    doc = await tarefa.promise
  } catch (error) {
    if (error?.name === 'PasswordException') {
      // code 1 = precisa de senha, 2 = a senha informada está errada
      throw new PdfPrecisaSenha(error.code === 2)
    }
    throw new Error('Não consegui abrir esse PDF. Confira se o arquivo não está corrompido.')
  }

  try {
    const paginas = []
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n)
      const conteudo = await pagina.getTextContent()
      paginas.push(reconstruirLinhas(conteudo.items).join('\n'))
      pagina.cleanup()
    }
    return { texto: paginas.join('\n\n').trim(), numPaginas: doc.numPages }
  } finally {
    // Na pdfjs-dist 6 quem encerra o worker é a tarefa de carregamento, não o
    // documento — o proxy do documento não tem destroy().
    await tarefa.destroy()
  }
}
