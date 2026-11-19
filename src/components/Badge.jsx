const STATUS_LABELS = {
  pendente: 'Pendente',
  confirmado: 'Confirmada',
  concluido: 'Concluída',
  cancelado: 'Cancelada',
  ativa: 'Ativa',
  inativa: 'Inativa',
};

const STATUS_STYLES = {
  pendente: 'bg-amber-100 text-amber-900',
  confirmado: 'bg-emerald-100 text-emerald-900',
  concluido: 'bg-slate-100 text-slate-800',
  cancelado: 'bg-rose-100 text-rose-900',
  ativa: 'bg-emerald-100 text-emerald-900',
  inativa: 'bg-slate-100 text-slate-800',
};

/**
 * @param {{ status: keyof typeof STATUS_LABELS, children?: import('react').ReactNode }} props
 */
export function Badge({ status, children }) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.inativa}`}>
      {children || STATUS_LABELS[status] || status}
    </span>
  );
}
