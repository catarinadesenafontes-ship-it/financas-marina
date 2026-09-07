import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

// A leitura de uma fatura longa passa dos 10s padrão da Vercel.
export const maxDuration = 60

// valor sempre positivo — o sinal vem de `tipo`, não do número, para não
// depender de como cada banco imprime negativo (-10,00 / 10,00- / (10,00)).
const LinhaFatura = z.object({
  data: z.string().describe('data da compra no formato AAAA-MM-DD'),
  descricao: z.string().describe('descrição como aparece na fatura, sem cortar'),
  valor: z.number().describe('valor absoluto em reais, sempre positivo'),
  tipo: z
    .enum(['compra', 'estorno', 'pagamento', 'encargo'])
    .describe('compra = gasto; estorno = devolução; pagamento = pagamento da fatura anterior; encargo = juros, multa, anuidade, IOF'),
  parcela_atual: z.number().nullable().describe('número da parcela, ou null se à vista'),
  parcela_total: z.number().nullable().describe('total de parcelas, ou null se à vista'),
})

const LinhaExtrato = z.object({
  data: z.string().describe('data do lançamento no formato AAAA-MM-DD'),
  descricao: z.string().describe('descrição como aparece no extrato, sem cortar'),
  valor: z.number().describe('valor absoluto em reais, sempre positivo'),
  tipo: z.enum(['entrada', 'saida']).describe('entrada = crédito na conta; saida = débito'),
})

const Fatura = z.object({
  banco: z.string().nullable(),
  final_cartao: z.string().nullable().describe('últimos 4 dígitos, se aparecerem'),
  vencimento: z.string().nullable().describe('AAAA-MM-DD'),
  total_fatura: z.number().nullable(),
  linhas: z.array(LinhaFatura),
})

const Extrato = z.object({
  banco: z.string().nullable(),
  periodo_inicio: z.string().nullable().describe('AAAA-MM-DD'),
  periodo_fim: z.string().nullable().describe('AAAA-MM-DD'),
  saldo_final: z.number().nullable(),
  linhas: z.array(LinhaExtrato),
})

const INSTRUCOES = `Você extrai lançamentos de documentos bancários brasileiros.

Regras:
- Devolva TODAS as linhas de lançamento do documento, na ordem em que aparecem. Não resuma, não agrupe, não pule linha nenhuma.
- Datas em AAAA-MM-DD. O documento costuma trazer DD/MM ou DD/MMM sem o ano — deduza o ano pelo período do documento, virando o ano quando os meses dão a volta (dezembro seguido de janeiro).
- Valores em número, sempre positivos, com ponto decimal. "1.234,56" vira 1234.56.
- Não invente lançamento e não conserte o que está escrito: copie a descrição como está no documento.
- Ignore cabeçalho, rodapé, propaganda, limites, saldo disponível e linhas de total. Total e saldo têm campo próprio.
- Parcelamento costuma vir como "PARC 03/10", "3/10" ou "(3 de 10)" na descrição: preencha parcela_atual e parcela_total e deixe a descrição inteira mesmo assim.

Se o texto não for um documento bancário, ou estiver ilegível, devolva a lista de linhas vazia.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Use POST.' })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      erro: 'ANTHROPIC_API_KEY não está configurada nas variáveis de ambiente da Vercel.',
    })
  }

  const { texto, tipo } = req.body ?? {}

  if (typeof texto !== 'string' || texto.trim().length < 40) {
    return res.status(400).json({
      erro: 'Não consegui ler texto nenhum desse PDF. Se ele for uma imagem escaneada, precisa de um PDF com texto de verdade.',
    })
  }
  if (tipo !== 'fatura_cartao' && tipo !== 'extrato_cc') {
    return res.status(400).json({ erro: 'tipo deve ser fatura_cartao ou extrato_cc.' })
  }

  // Cortar o texto perderia lançamentos em silêncio — melhor recusar e avisar.
  if (texto.length > 400_000) {
    return res.status(413).json({
      erro: 'Documento grande demais para uma leitura só. Suba um período menor.',
    })
  }

  const ehFatura = tipo === 'fatura_cartao'
  // Construído aqui, e não no topo do módulo: sem chave, o construtor lança e
  // derrubaria a função antes de chegar na mensagem de erro acima.
  const client = new Anthropic()

  try {
    const resposta = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: INSTRUCOES,
      thinking: { type: 'adaptive' },
      output_config: {
        // Extração é trabalho mecânico: `medium` mantém a resposta dentro da
        // janela da função serverless sem perder linha.
        effort: 'medium',
        format: zodOutputFormat(ehFatura ? Fatura : Extrato),
      },
      messages: [
        {
          role: 'user',
          content: `Texto extraído de ${ehFatura ? 'uma fatura de cartão de crédito' : 'um extrato de conta-corrente'}:\n\n${texto}`,
        },
      ],
    })

    if (resposta.stop_reason === 'refusal') {
      return res.status(422).json({ erro: 'A leitura foi recusada por segurança. Confira o arquivo.' })
    }
    if (resposta.stop_reason === 'max_tokens') {
      return res.status(422).json({
        erro: 'A fatura tem lançamentos demais para uma leitura só. Suba um período menor.',
      })
    }
    if (!resposta.parsed_output) {
      return res.status(502).json({ erro: 'Não consegui estruturar o documento. Tente de novo.' })
    }

    return res.status(200).json({ tipo, ...resposta.parsed_output })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ erro: 'Chave da Anthropic API inválida.' })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ erro: 'Limite de uso da API atingido. Tente de novo em alguns minutos.' })
    }
    console.error('Falha ao ler documento:', error)
    return res.status(500).json({ erro: 'Não consegui ler o documento. Tente de novo.' })
  }
}
