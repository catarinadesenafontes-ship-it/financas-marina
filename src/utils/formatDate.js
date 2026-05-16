export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function formatMonthYear(dateStr) {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthOptions(count = 12) {
  const options = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    options.push({ value, label: formatMonthYear(value) })
  }
  return options
}
