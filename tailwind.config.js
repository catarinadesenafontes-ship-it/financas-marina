/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'green-deep':    '#1A3D2B',
        'green-mid':     '#2D5C3E',
        'green-soft':    '#7EC8A4',
        'green-pale':    '#C8E6D8',
        'cream':         '#F2EFE3',
        'cream-dark':    '#E5E0D0',
        'surface':       '#FFFFFF',
        'text-primary':  '#1A3D2B',
        'text-secondary':'#4A6458',
        'text-muted':    '#8BA898',
        'danger':        '#C0392B',
        'warning':       '#D97706',
        'itau':          '#EC7000',
        'inter':         '#FF6600',
      },
      fontFamily: {
        sans:  ['DM Sans', 'sans-serif'],
        mono:  ['DM Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '20px',
        'fab': '9999px',
      },
      boxShadow: {
        'card': '0 2px 16px rgba(26,61,43,0.08)',
        'fab':  '0 4px 20px rgba(26,61,43,0.30)',
      },
    },
  },
  plugins: [],
}
