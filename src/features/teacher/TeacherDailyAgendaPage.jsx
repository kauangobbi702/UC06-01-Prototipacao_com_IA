import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../supabase.js';
import { Agenda } from '../../components/Agenda.jsx';
import { Button } from '../../components/Button.jsx';
import { Card } from '../../components/Card.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { LoadingState } from '../../components/LoadingState.jsx';
import { formatLocalDate, getLocalDateTime, todayInSaoPaulo } from '../../lib/dates.js';
import { getSupabaseErrorMessage, STATUS } from '../../lib/status.js';

function dateBounds(date) {
  const start = new Date(`${date}T00:00:00-03:00`);
  const end = new Date(`${date}T00:00:00-03:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * @param {{ profile: {id: string, nome: string}, onBack: () => void }} props
 */
export function TeacherDailyAgendaPage({ profile, onBack }) {
  const [date, setDate] = useState(todayInSaoPaulo());
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [errorMessage, setErrorMessage] = useState('');
  const [busyBookingId, setBusyBookingId] = useState('');

  const loadBookings = useCallback(async () => {
    setStatus(STATUS.LOADING);
    setErrorMessage('');
    const { start, end } = dateBounds(date);
    const { data, error } = await supabase.from('agendamentos')
      .select(`
        id,aula_id,aluno_id,aluno_nome,aluno_email,aluno_telefone,
        inicio,fim,duracao_min,status,
        aula:aulas!agendamentos_aula_professora_fk(nome),
        aluno:alunos!agendamentos_aluno_fk(nome,email,telefone)
      `)
      .eq('professora_id', profile.id)
      .gte('inicio', start)
      .lt('inicio', end)
      .order('inicio');
    if (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
      return;
    }
    const normalized = (data || []).map((booking) => ({
      ...booking,
      aula_nome: booking.aula?.nome || 'Aula',
      aluno_nome: booking.aluno?.nome || booking.aluno_nome,
      inicioLocal: getLocalDateTime(booking.inicio),
      fimLocal: getLocalDateTime(booking.fim),
    }));
    setBookings(normalized);
    setStatus(normalized.length ? STATUS.SUCCESS : STATUS.EMPTY);
  }, [date, profile.id]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  async function updateBooking(booking, action) {
    const nextStatus = {
      confirmar: 'confirmado',
      concluir: 'concluido',
      cancelar: 'cancelado',
    }[action];
    if (!nextStatus) return;
    setBusyBookingId(booking.id);
    const { error } = await supabase.from('agendamentos')
      .update({ status: nextStatus })
      .eq('id', booking.id)
      .eq('professora_id', profile.id);
    if (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
    } else {
      await loadBookings();
    }
    setBusyBookingId('');
  }

  function shiftDate(amount) {
    const [year, month, day] = date.split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day + amount, 12));
    setDate(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(shifted));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onBack}>Voltar</Button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{profile.nome}</p>
          <h1 className="text-2xl font-bold">Agenda do dia</h1>
        </div>
      </header>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="secondary" aria-label="Dia anterior" onClick={() => shiftDate(-1)}>‹ Dia anterior</Button>
          <label className="min-w-48 flex-1 text-sm font-medium">
            Data da agenda
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-surface px-3" />
          </label>
          <Button variant="secondary" aria-label="Próximo dia" onClick={() => shiftDate(1)}>Próximo dia ›</Button>
        </div>
        <p className="mt-3 text-sm text-muted">{formatLocalDate(date, { dateStyle: 'full' })} · fuso de São Paulo</p>
      </Card>

      {status === STATUS.LOADING && <LoadingState label="Carregando agenda do dia" />}
      {status === STATUS.ERROR && <ErrorState message={errorMessage} onRetry={loadBookings} />}
      {status === STATUS.EMPTY && <EmptyState title="Nenhuma aula agendada neste dia" description="Os horários abaixo estão livres de reservas." />}
      {(status === STATUS.SUCCESS || status === STATUS.EMPTY) && (
        <section aria-label={`Agenda de ${formatLocalDate(date, { dateStyle: 'full' })}`}>
          <Agenda
            bookings={bookings}
            date={date}
            onBookingAction={(booking, action) => updateBooking(booking, action)}
          />
          {busyBookingId && <p className="sr-only" role="status" aria-live="polite">Atualizando agendamento…</p>}
        </section>
      )}
    </main>
  );
}
