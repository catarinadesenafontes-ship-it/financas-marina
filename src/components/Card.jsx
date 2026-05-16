export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-surface rounded-2xl shadow-card p-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
