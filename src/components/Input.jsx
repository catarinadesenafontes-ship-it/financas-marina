export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={`
          w-full rounded-xl bg-cream border border-cream-dark px-4 py-3
          text-sm text-text-primary placeholder:text-text-muted
          focus:outline-none focus:border-green-deep transition-colors
          ${error ? 'border-danger' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        className={`
          w-full rounded-xl bg-cream border border-cream-dark px-4 py-3
          text-sm text-text-primary
          focus:outline-none focus:border-green-deep transition-colors
          ${error ? 'border-danger' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
