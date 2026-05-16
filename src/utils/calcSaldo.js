export function calcSaldo(lancamentos = []) {
  return lancamentos.reduce((acc, l) => {
    if (l.tipo === 'entrada') return acc + Number(l.valor)
    if (l.tipo === 'saida') return acc - Number(l.valor)
    if (l.tipo === 'transferencia') {
      // transferências são criadas em pares; o saldo é deduzido pelo par
      return acc + Number(l.valor) * (l._direcao === 'entrada' ? 1 : -1)
    }
    return acc
  }, 0)
}

export function calcSaldoConta(lancamentos = []) {
  return lancamentos.reduce((acc, l) => {
    if (l.tipo === 'entrada') return acc + Number(l.valor)
    if (l.tipo === 'saida') return acc - Number(l.valor)
    if (l.tipo === 'transferencia') {
      // se tem par: é saída; se não tem par apontado para ele, é entrada
      // usamos o campo transferencia_par_id para identificar
      // na listagem já vem com tipo correto — a saída tem valor negativo implícito
      return acc - Number(l.valor)
    }
    return acc
  }, 0)
}
