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
