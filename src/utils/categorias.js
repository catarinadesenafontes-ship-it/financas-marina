export const CATEGORIAS_DESPESA = [
  'Academia',
  'Consultas',
  'Cursos',
  'Exames',
  'Farmácia',
  'Lazer',
  'Lanches',
  'Passagens aéreas',
  'Passagens de ônibus',
  'Presentes',
  'Supermercado',
  'Transporte Urbano',
  'Uber',
  'Vestuário',
]

export const CATEGORIAS_RECEITA = [
  'Mesada Família',
  'Salário Estágio',
  'Salário Origem',
]

export const CATEGORIAS_ALL = [...new Set([...CATEGORIAS_DESPESA, ...CATEGORIAS_RECEITA])].sort()
