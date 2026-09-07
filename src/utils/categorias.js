export const CATEGORIAS_DESPESA_CARTAO = [
  'Academia',
  'Alimentação',
  'Aplicativos',
  'Consultas',
  'Cursos',
  'Eletrônicos',
  'Exames',
  'Farmácia',
  'Hortifruti',
  'Ifood',
  'Lazer',
  'Lanches',
  'Livros',
  'Papelaria',
  'Passagens aéreas',
  'Passagens de ônibus',
  'Presentes',
  'Restaurantes',
  'Supermercado',
  'Transporte Urbano',
  'Uber',
  'Vestuário',
  'Outros',
]

export const CATEGORIAS_DESPESA_CONTAS = [
  'Academia',
  'Alimentação',
  'Aplicativos',
  'Consultas',
  'Conta TIM',
  'Cursos',
  'Eletrônicos',
  'Exames',
  'Farmácia',
  'Fatura de cartão de crédito',
  'Faxina',
  'Hortifruti',
  'Ifood',
  'Lazer',
  'Lanches',
  'Livros',
  'Papelaria',
  'Passagens aéreas',
  'Passagens de ônibus',
  'Presentes',
  'Restaurantes',
  'Supermercado',
  'Transporte Urbano',
  'Uber',
  'Vestuário',
  'Outros',
]

// Alias para compatibilidade com imports existentes não refatorados
export const CATEGORIAS_DESPESA = CATEGORIAS_DESPESA_CARTAO

export const CATEGORIAS_RECEITA = [
  'Mesada Família',
  'Outros recebimentos',
  'Presentes',
  'Reembolso',
  'Salário Estágio',
  'Salário Origem',
]

export const CATEGORIAS_ALL = [...new Set([...CATEGORIAS_DESPESA_CONTAS, ...CATEGORIAS_RECEITA])].sort()

export const CATEGORIAS_OCULTAS_ANALISES = ['Saldo Histórico']

// Pagar a fatura não é um gasto novo: as compras já entraram uma a uma pela aba
// Cartão. A linha continua valendo na conta-corrente (o dinheiro sai de verdade
// e mexe no saldo), mas fica fora dos totais de despesa das análises — senão o
// mesmo dinheiro seria contado duas vezes.
export const CATEGORIA_FATURA_CARTAO = 'Fatura de cartão de crédito'
