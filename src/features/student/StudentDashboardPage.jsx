import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../supabase.js';
import { Badge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { Card } from '../../components/Card.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { LoadingState } from '../../components/LoadingState.jsx';
import { addLocalDays, formatLocalDate, getLocalDateTime, todayInSaoPaulo } from '../../lib/dates.js';
import { getSupabaseErrorMessage, STATUS } from '../../lib/status.js';

async function loadSlots(booking) {
  const today = todayInSaoPaulo();
  const dates = Array.from({ length: 14 }, (_, index) => addLocalDays(today, index));
  const responses = await Promise.all(dates.map((date) => supabase.rpc('listar_horarios_livres', {
    slug: booking.professora_slug,
    aula_id: booking.aula_id,
    data: date,
  })));
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;

  const earliestStart = Date.now() + booking.antecedencia_cancelamento_horas * 60 * 60 * 1000;
  return responses.flatMap((response, index) => (response.data || [])
    .filter((slot) => new Date(slot.inicio).getTime() >= earliestStart)
    .map((slot) => ({ ...slot, ...getLocalDateTime(slot.inicio), date: dates[index] })))
    .filter((slot) => slot.inicio !== booking.inicio)
    .sort((first, second) => new Date(first.inicio) - new Date(second.inicio));
}

/**
 * @param {{ onEditProfile: () => void, onLogout: () => void }} props
 */
export function StudentDashboardPage({ onEditProfile, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [reschedule, setReschedule] = useState(null);

  const loadBookings = useCallback(async () => {
    setStatus(STATUS.LOADING);
    setError('');
    const { data, error: resultError } = await supabase.rpc('listar_meus_agendamentos');
    if (resultError) {
      setError(getSupabaseErrorMessage(resultError));
      setStatus(STATUS.ERROR);
      return;
    }
    setBookings(data || []);
    setStatus(data?.length ? STATUS.SUCCESS : STATUS.EMPTY);
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  async function cancelBooking(booking) {
    if (!window.confirm('Tem certeza que deseja cancelar esta aula?')) return;
    setBusyId(booking.id);
    setNotice('');
    const { error: actionError } = await supabase.rpc('cancelar_agendamento', {
      p_agendamento_id: booking.id,
    });
    if (actionError) {
      setNotice(getSupabaseErrorMessage(actionError));
      setNoticeIsError(true);
    } else {
      setNotice('Aula cancelada. O horário está livre novamente.');
      setNoticeIsError(false);
      await loadBookings();
    }
    setBusyId('');
  }

  async function startReschedule(booking) {
    setBusyId(booking.id);
    setNotice('');
    try {
      const slots = await loadSlots(booking);
      setReschedule({ booking, slots, selected: slots[0]?.inicio || '' });
      if (!slots.length) {
        setNotice('Não há outros horários disponíveis nos próximos 14 dias.');
        setNoticeIsError(false);
      }
    } catch (slotError) {
      setNotice(getSupabaseErrorMessage(slotError));
      setNoticeIsError(true);
    } finally {
      setBusyId('');
    }
  }

  async function confirmReschedule(event) {
    event.preventDefault();
    if (!reschedule?.selected) {
      setNotice('Escolha um novo horário disponível.');
      setNoticeIsError(true);
      return;
    }
    setBusyId(reschedule.booking.id);
    setNotice('');
    const { error: actionError } = await supabase.rpc('reagendar_agendamento', {
      p_agendamento_id: reschedule.booking.id,
      p_novo_inicio: reschedule.selected,
    });
    if (actionError) {
      setNotice(getSupabaseErrorMessage(actionError));
      setNoticeIsError(true);
    } else {
      setReschedule(null);
      setNotice('Aula reagendada.');
      setNoticeIsError(false);
      await loadBookings();
    }
    setBusyId('');
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Área do aluno</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Minhas aulas</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onEditProfile}>Meu perfil</Button>
          <Button variant="ghost" onClick={onLogout}>Sair</Button>
        </div>
      </header>

      <Card>
        <p className="text-sm text-muted">
          Para contratar uma aula, abra o link público compartilhado pela professora. Seus agendamentos ficarão vinculados a esta conta.
        </p>
      </Card>

      {notice && (
        <p className={`rounded-xl p-3 text-sm ${noticeIsError ? 'bg-rose-50 text-danger' : 'bg-emerald-50 text-emerald-900'}`} role={noticeIsError ? 'alert' : 'status'} aria-live={noticeIsError ? 'assertive' : 'polite'}>
          {notice}
        </p>
      )}
      {status === STATUS.LOADING && <LoadingState label="Carregando suas aulas" rows={2} />}
      {status === STATUS.ERROR && <ErrorState message={error} onRetry={loadBookings} />}
      {status === STATUS.EMPTY && <EmptyState title="Você ainda não tem aulas" description="Abra o link da professora para escolher uma aula e um horário disponível." />}
      {status === STATUS.SUCCESS && (
        <ul className="space-y-3">
          {bookings.map((booking) => {
            const local = getLocalDateTime(booking.inicio);
            const canChange = Date.now() <= new Date(booking.inicio).getTime()
              - booking.antecedencia_cancelamento_horas * 60 * 60 * 1000;
            return (
              <li key={booking.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{booking.aula_nome}</h2>
                      <p className="mt-1 text-sm text-muted">Professora {booking.professora_nome}</p>
                      <p className="mt-1 text-sm text-muted">{formatLocalDate(local.date, { dateStyle: 'long' })} às {local.time}</p>
                    </div>
                    <Badge status={booking.status}>{booking.status}</Badge>
                  </div>
                  {['pendente', 'confirmado'].includes(booking.status) && canChange && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="secondary" loading={busyId === booking.id} onClick={() => cancelBooking(booking)}>Cancelar</Button>
                      <Button variant="secondary" loading={busyId === booking.id} onClick={() => startReschedule(booking)}>Reagendar</Button>
                    </div>
                  )}
                  {['pendente', 'confirmado'].includes(booking.status) && !canChange && (
                    <p className="mt-3 text-sm text-muted">O prazo para alterar esta aula terminou.</p>
                  )}
                  {reschedule?.booking.id === booking.id && (
                    <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={confirmReschedule}>
                      {reschedule.slots.length > 0 && (
                        <>
                          <select
                            className="min-h-11 flex-1 rounded-xl border border-border px-3"
                            value={reschedule.selected}
                            onChange={(event) => setReschedule((current) => ({ ...current, selected: event.target.value }))}
                            aria-label="Novo horário"
                          >
                            {reschedule.slots.map((slot) => (
                              <option key={slot.inicio} value={slot.inicio}>
                                {formatLocalDate(slot.date, { dateStyle: 'medium' })} às {slot.time}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" loading={busyId === booking.id}>Confirmar novo horário</Button>
                        </>
                      )}
                    </form>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
