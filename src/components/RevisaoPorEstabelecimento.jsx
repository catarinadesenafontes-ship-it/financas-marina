import { useState } from 'react'
import { ChevronDown, ArrowLeftRight } from 'lucide-react'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'

/**
 * Revisão de extrato agrupada por estabelecimento.
 *
 * Um extrato de quatro meses tem centenas de linhas mas poucas dezenas de
 * lugares. Escolher a categoria por lugar, e não por linha, é a diferença entre
 * 20 decisões e 344.
 */
export function RevisaoPorEstabelecimento({ grupos, categorias, onCategoria, onIncluir }) {
  return (
    <div className="flex flex-col gap-2">
      {grupos.map(grupo => (
        <Grupo
          key={grupo.chave}
          grupo={grupo}
          categorias={categorias}
          onCategoria={c => onCategoria(grupo.chave, c)}
          onIncluir={v => onIncluir(grupo.chave, v)}
        />
      ))}
    </div>
  )
}

function Grupo({ grupo, categorias, onCategoria, onIncluir }) {
  const [aberto, setAberto] = useState(false)
  const ehTransferencia = grupo.linhas.some(l => l.ehTransferenciaPropria)
  const positivo = grupo.total >= 0

  return (
    <div className={`bg-surface rounded-xl shadow-card overflow-hidden transition-opacity ${grupo.incluir ? '' : 'opacity-50'}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        <input
          type="checkbox"
          checked={grupo.incluir}
          onChange={e => onIncluir(e.target.checked)}
          className="w-4 h-4 accent-green-deep flex-shrink-0 cursor-pointer"
        />

        <button onClick={() => setAberto(v => !v)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-text-primary truncate">{grupo.rotulo}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-text-muted">
              {grupo.quantidade} lançamento{grupo.quantidade === 1 ? '' : 's'}
            </span>
            {ehTransferencia && (
              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                <ArrowLeftRight size={9} />
                transferência entre suas contas
              </span>
            )}
          </div>
        </button>

        <span className={`font-mono text-sm font-semibold flex-shrink-0 ${positivo ? 'text-green-deep' : 'text-danger'}`}>
          {positivo ? '+' : '-'}{formatCurrency(Math.abs(grupo.total))}
        </span>

        <button onClick={() => setAberto(v => !v)} className="p-1 text-text-muted flex-shrink-0">
          <ChevronDown size={14} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {grupo.incluir && (
        <div className="px-4 pb-3 pl-11">
          <select
            value={grupo.categoria ?? ''}
            onChange={e => onCategoria(e.target.value || null)}
            className={`w-full text-xs border rounded-lg px-2 py-1.5 cursor-pointer
              ${grupo.categoria
                ? 'bg-cream border-cream-dark text-text-primary'
                : 'bg-orange-50 border-orange-200 text-text-muted'}`}
          >
            <option value="">
              {grupo.categoria === null && grupo.quantidade > 1 ? 'Sem categoria (vale para os ' + grupo.quantidade + ')' : 'Sem categoria'}
            </option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {aberto && (
        <div className="border-t border-cream-dark bg-cream/40">
          {grupo.linhas.map((l, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-cream-dark/40 last:border-0">
              <span className="text-[11px] text-text-muted">{formatDate(l.data)}</span>
              <span className="text-[11px] text-text-primary flex-1 px-3 truncate">{l.descricao}</span>
              <span className={`font-mono text-[11px] ${l.tipo === 'entrada' ? 'text-green-deep' : 'text-danger'}`}>
                {l.tipo === 'entrada' ? '+' : '-'}{formatCurrency(Number(l.valor))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
