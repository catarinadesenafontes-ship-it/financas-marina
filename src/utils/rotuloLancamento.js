// A descrição é opcional: na maior parte dos lançamentos a categoria já
// identifica o gasto. Quando não há descrição, é ela que aparece na lista.
export function rotuloLancamento(item) {
  const descricao = item?.descricao?.trim()
  if (descricao) return descricao
  if (item?.tipo === 'transferencia') return 'Transferência'
  return item?.categoria?.trim() || 'Sem descrição'
}

// Na gravação, campo em branco vira NULL — assim não existem dois jeitos de
// dizer "sem descrição" no banco.
export function normalizarDescricao(valor) {
  const descricao = String(valor ?? '').trim()
  return descricao || null
}
