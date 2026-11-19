import { Button } from './Button.jsx';

/**
 * @param {{ title: string, description: string, actionLabel?: string, onAction?: () => void }} props
 */
export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="mb-4 h-12 w-12 text-accent" fill="none">
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
        <path d="M24 15v18M15 24h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      {actionLabel && onAction && <Button className="mt-5" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
