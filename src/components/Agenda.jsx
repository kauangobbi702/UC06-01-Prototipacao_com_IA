import { Badge } from './Badge.jsx';

const START_HOUR = 7;
const END_HOUR = 22;
const HALF_HOUR_SLOTS = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, index) => {
  const totalMinutes = START_HOUR * 60 + index * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
});

function minutesSinceMidnight(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * @param {{ bookings: Array<{id: string, inicio: string, fim: string, aula_nome?: string, aluno_nome?: string, status: string}>, date: string, onBookingAction?: (booking: object, action: string) => void }} props
 */
export function Agenda({ bookings, date, onBookingAction }) {
  const dateBookings = bookings.map((booking) => ({
    ...booking,
    startDate: booking.inicioLocal?.date || booking.inicio.slice(0, 10),
    startTime: booking.inicioLocal?.time || booking.inicio.slice(11, 16),
    endDate: booking.fimLocal?.date || booking.fim.slice(0, 10),
    endTime: booking.fimLocal?.time || booking.fim.slice(11, 16),
  })).filter((booking) => booking.startDate === date);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <ol className="min-w-[320px] divide-y divide-border" aria-label="Grade de horários do dia">
        {HALF_HOUR_SLOTS.map((time) => {
          const minute = minutesSinceMidnight(time);
          const booking = dateBookings.find((item) => item.startTime === time);
          const ongoingBooking = dateBookings.find((item) => {
            if (!['pendente', 'confirmado', 'concluido'].includes(item.status)) return false;
            const start = minutesSinceMidnight(item.startTime);
            const end = item.endDate === item.startDate ? minutesSinceMidnight(item.endTime) : 24 * 60;
            return start < minute && end > minute;
          });
          return (
            <li key={time} className="grid min-h-14 grid-cols-[4.5rem_1fr]">
              <time className="border-r border-border px-3 py-4 text-sm text-muted">{time}</time>
              <div className="p-2">
                {booking ? (
                  <div className={`rounded-xl border p-3 ${booking.status === 'cancelado' ? 'border-border bg-bg' : 'border-primary/20 bg-primary/5'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{booking.aula_nome || 'Aula'}</p>
                        <p className="text-sm text-muted">{booking.aluno_nome || 'Aluno'} · {booking.startTime}–{booking.endTime}</p>
                      </div>
                      <Badge status={booking.status}>{booking.status}</Badge>
                    </div>
                    {onBookingAction && ['pendente', 'confirmado'].includes(booking.status) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {booking.status === 'pendente' && <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary" onClick={() => onBookingAction(booking, 'confirmar')}>Confirmar</button>}
                        {booking.status === 'confirmado' && <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary" onClick={() => onBookingAction(booking, 'concluir')}>Marcar como concluída</button>}
                        <button type="button" className="min-h-11 rounded-lg px-3 text-sm font-semibold text-danger" onClick={() => onBookingAction(booking, 'cancelar')}>Cancelar</button>
                      </div>
                    )}
                  </div>
                ) : ongoingBooking ? (
                  <span className="text-sm text-muted">Aula em andamento: {ongoingBooking.aula_nome || 'Aula'}</span>
                ) : (
                  <span className="text-sm text-muted">Horário livre</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
