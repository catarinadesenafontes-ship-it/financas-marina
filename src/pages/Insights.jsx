import { useInsights } from '../hooks/useInsights'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'

const TYPE_STYLE = {
  danger:  { bg: 'bg-red-50',    border: 'border-red-200',    title: 'text-danger',      dot: 'bg-danger' },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  title: 'text-warning',     dot: 'bg-warning' },
  success: { bg: 'bg-green-pale',border: 'border-green-200',  title: 'text-green-deep',  dot: 'bg-green-deep' },
  neutral: { bg: 'bg-cream',     border: 'border-cream-dark', title: 'text-text-secondary', dot: 'bg-text-muted' },
}

function InsightCard({ insight }) {
  const s = TYPE_STYLE[insight.type] ?? TYPE_STYLE.neutral
  return (
    <div className={`rounded-xl border px-4 py-4 flex gap-3 ${s.bg} ${s.border}`}>
      <span className="text-xl leading-none mt-0.5 flex-shrink-0">{insight.emoji}</span>
      <div className="flex flex-col gap-1">
        <p className={`text-sm font-semibold ${s.title}`}>{insight.title}</p>
        <p className="text-sm text-text-secondary leading-relaxed">{insight.message}</p>
      </div>
    </div>
  )
}

export function Insights() {
  const { insights, isLoading } = useInsights()

  return (
    <div>
      <PageHeader title="Insights" />

      <div className="px-4 md:px-0 pb-28 md:pb-0 space-y-4">
        <Card className="space-y-1">
          <p className="text-sm font-semibold text-text-primary">Seus insights do mês</p>
          <p className="text-xs text-text-muted">Como você está indo e o que pode melhorar</p>
        </Card>

        {isLoading ? (
          <div className="text-center py-10 text-text-muted text-sm">Carregando...</div>
        ) : insights.length === 0 ? (
          <div className="text-center py-10 text-text-muted text-sm">
            Continue registrando seus lançamentos para receber insights personalizados 🌿
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
