const START_HOUR = 7;
const END_HOUR = 22;
const HALF_HOUR_SLOTS = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, index) => {
  const totalMinutes = START_HOUR * 60 + index * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
});

/**
 * @param {{ bookings: Array<{inicio: string, fim: string, aula_nome?: string, aluno_nome?: string, status: string}>, date: string, onBookingAction?: (booking: object, action: string) => void }} props
 */
export function Agenda({ bookings, date, onBookingAction }) {
  const dateBookings = bookings.filter((booking) => booking.inicio.slice(0, 10) === date);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <ol className="min-w-[320px] divide-y divide-border">
        {HALF_HOUR_SLOTS.map((time) => {
          const booking = dateBookings.find((item) => {
            const start = new Date(item.inicio);
            return `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` === time;
          });
          return (
            <li key={time} className="grid min-h-14 grid-cols-[4.5rem_1fr]">
              <time className="border-r border-border px-3 py-4 text-sm text-muted">{time}</time>
              <div className="p-2">
                {booking ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="font-semibold">{booking.aula_nome || 'Aula'}</p>
                    <p className="text-sm text-muted">{booking.aluno_nome || 'Aluno'} · {booking.status}</p>
                    {onBookingAction && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {booking.status === 'pendente' && <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary" onClick={() => onBookingAction(booking, 'confirmar')}>Confirmar</button>}
                        {booking.status === 'confirmado' && <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary" onClick={() => onBookingAction(booking, 'concluir')}>Marcar como concluída</button>}
                        <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-danger" onClick={() => onBookingAction(booking, 'cancelar')}>Cancelar</button>
                      </div>
                    )}
                  </div>
                ) : <span className="text-sm text-muted">Horário livre</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
