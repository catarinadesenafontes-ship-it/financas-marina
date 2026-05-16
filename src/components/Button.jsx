export function Button({ children, variant = 'primary', className = '', disabled, loading, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-green-deep text-white hover:bg-green-mid active:scale-95',
    secondary: 'border border-green-deep text-green-deep bg-transparent hover:bg-green-pale active:scale-95',
    danger: 'bg-danger text-white hover:opacity-90 active:scale-95',
    ghost: 'text-text-secondary hover:bg-cream-dark active:scale-95',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : null}
      {children}
    </button>
  )
}
