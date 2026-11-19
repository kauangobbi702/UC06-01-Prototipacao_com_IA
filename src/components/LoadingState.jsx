/**
 * @param {{ label?: string, rows?: number }} props
 */
export function LoadingState({ label = 'Carregando…', rows = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-2xl border border-border bg-surface" />
      ))}
    </div>
  );
}
