import {
  Dumbbell, Stethoscope, GraduationCap, FileText, Pill,
  Gamepad2, Coffee, Plane, Bus, Gift, ShoppingCart, Train,
  Car, Shirt, Heart, Briefcase, DollarSign,
  ArrowRightLeft, TrendingUp, TrendingDown, MoreHorizontal,
} from 'lucide-react'

const map = {
  // Despesas
  'Academia':             Dumbbell,
  'Consultas':            Stethoscope,
  'Cursos':               GraduationCap,
  'Exames':               FileText,
  'Farmácia':             Pill,
  'Lazer':                Gamepad2,
  'Lanches':              Coffee,
  'Passagens aéreas':     Plane,
  'Passagens de ônibus':  Bus,
  'Presentes':            Gift,
  'Supermercado':         ShoppingCart,
  'Transporte Urbano':    Train,
  'Uber':                 Car,
  'Vestuário':            Shirt,
  // Receitas
  'Mesada Família':       Heart,
  'Salário Estágio':      Briefcase,
  'Salário Origem':       DollarSign,
  // Tipos
  'Transferência':        ArrowRightLeft,
  'Entrada':              TrendingUp,
  'Saída':                TrendingDown,
}

export function CategoryIcon({ categoria, size = 16, className = '' }) {
  const Icon = map[categoria] ?? MoreHorizontal
  return <Icon size={size} className={className} />
}
