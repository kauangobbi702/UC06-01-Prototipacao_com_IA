const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary/90',
  secondary: 'border border-border bg-surface text-text hover:border-primary hover:text-primary',
  ghost: 'text-text hover:bg-bg',
  danger: 'bg-danger text-white hover:bg-danger/90',
};

/**
 * @param {{ children: import('react').ReactNode, variant?: 'primary'|'secondary'|'ghost'|'danger', type?: 'button'|'submit'|'reset', loading?: boolean, disabled?: boolean, className?: string, onClick?: import('react').MouseEventHandler<HTMLButtonElement>, 'aria-label'?: string }} props
 */
export function Button({
  children,
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {loading ? 'Salvando...' : children}
    </button>
  );
}
