import { Button } from './Button.jsx';

/**
 * @param {{ message: string, onRetry?: () => void }} props
 */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert" aria-live="assertive">
      <h2 className="font-semibold text-danger">Algo não deu certo</h2>
      <p className="mt-1 text-sm text-danger">{message}</p>
      {onRetry && <Button variant="secondary" className="mt-4" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}
