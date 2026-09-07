// Fonte única da direção de um lançamento de conta-corrente.
//
// 'entrada' e 'saida' se explicam sozinhos. Transferência é gravada como um par
// de linhas — uma em cada conta — e a direção vem da coluna `direcao`
// (migration 4). Antes dela a direção era inferida de transferencia_par_id, mas
// as duas pernas apontam uma para a outra: o teste dava "entrada" para ambas e a
// saída da conta de origem entrava como crédito.

// Linhas anteriores à migration 4 ficam com direcao nula. Nelas vale o mesmo
// critério do backfill: criarTransferencia() insere a saída primeiro, então
// dentro do par a perna mais antiga é a saída.
function isEntradaLegado(l, todos) {
  const par = todos.find(p => p.id === l.transferencia_par_id)
  if (!par) return false

  const t = Date.parse(l.created_at)
  const tPar = Date.parse(par.created_at)
  if (Number.isFinite(t) && Number.isFinite(tPar) && t !== tPar) return t > tPar

  // Date.parse só tem precisão de milissegundo. No empate o id decide: a escolha
  // pode inverter as duas contas, mas o par continua somando zero no consolidado.
  return String(l.id) > String(par.id)
}

// `todos` precisa ser a lista completa, sem filtro de conta — a perna oposta de
// uma transferência está sempre na outra conta.
export function isEntrada(lancamento, todos = []) {
  if (!lancamento) return false
  if (lancamento.tipo === 'entrada') return true
  if (lancamento.tipo !== 'transferencia') return false

  if (lancamento.direcao === 'entrada') return true
  if (lancamento.direcao === 'saida') return false

  return isEntradaLegado(lancamento, todos)
}

export function valorComSinal(lancamento, todos = []) {
  const valor = Math.abs(Number(lancamento?.valor) || 0)
  return isEntrada(lancamento, todos) ? valor : -valor
}

// Saldo de uma conta. Passe a lista completa: o filtro por conta acontece aqui
// dentro para que a perna oposta continue visível ao resolver transferências.
export function calcSaldoConta(lancamentos = [], contaId) {
  return lancamentos
    .filter(l => l.conta_id === contaId)
    .reduce((acc, l) => acc + valorComSinal(l, lancamentos), 0)
}

export function calcSaldo(lancamentos = []) {
  return lancamentos.reduce((acc, l) => acc + valorComSinal(l, lancamentos), 0)
}
