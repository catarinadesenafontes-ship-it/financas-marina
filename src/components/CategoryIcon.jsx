import {
  Utensils, Car, Heart, Gamepad2, BookOpen, Home, MoreHorizontal,
  ArrowRightLeft, TrendingUp, TrendingDown,
} from 'lucide-react'

const map = {
  'Alimentação': Utensils,
  'Transporte': Car,
  'Saúde': Heart,
  'Lazer': Gamepad2,
  'Educação': BookOpen,
  'Moradia': Home,
  'Transferência': ArrowRightLeft,
  'Entrada': TrendingUp,
  'Saída': TrendingDown,
}

export function CategoryIcon({ categoria, size = 16, className = '' }) {
  const Icon = map[categoria] ?? MoreHorizontal
  return <Icon size={size} className={className} />
}
