import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../supabase.js';
import { Badge } from '../../components/Badge.jsx';
import { Button } from '../../components/Button.jsx';
import { Card } from '../../components/Card.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { LoadingState } from '../../components/LoadingState.jsx';
import { addLocalDays, formatLocalDate, getLocalDateTime, getWeekday, todayInSaoPaulo } from '../../lib/dates.js';
import { getSupabaseErrorMessage, STATUS } from '../../lib/status.js';

const PRICE_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PRIVACY_VERSION = 'agendamento-v1';

function getSlug() {
  return new URLSearchParams(window.location.search).get('professora')?.trim().toLowerCase() || '';
}

async function queryAvailableSlots(teacher, lessonId, leadTime) {
  const today = todayInSaoPaulo();
  const dates = Array.from({ length: 14 }, (_, index) => addLocalDays(today, index));
  const responses = await Promise.all(dates.map((date) => supabase.rpc('listar_horarios_livres', {
    slug: teacher.slug,
    aula_id: lessonId,
    data: date,
  })));
  const failed = responses.find((response) => response.error);
  if (failed?.error) throw failed.error;

  const earliestStart = Date.now() + leadTime * 60 * 60 * 1000;
  return responses.flatMap((response, index) => (response.data || [])
    .filter((slot) => new Date(slot.inicio).getTime() >= earliestStart)
    .map((slot) => {
      const local = getLocalDateTime(slot.inicio);
      return { ...slot, ...local, date: local.date || dates[index] };
    }))
    .sort((first, second) => new Date(first.inicio) - new Date(second.inicio));
}

/**
 * @param {{ role: string|null, user: object|null, onRequireAuth: (selection?: {aulaId: string, date: string, inicio: string, professorSlug: string}) => void, onOpenTeacherPanel: () => void, onBack: () => void }} props
 */
export function StudentBookingPage({ role, user, onRequireAuth, onOpenTeacherPanel, onBack }) {
  const query = new URLSearchParams(window.location.search);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherSlug, setSelectedTeacherSlug] = useState(getSlug());
  const [pageStatus, setPageStatus] = useState(STATUS.LOADING);
  const [pageError, setPageError] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState(query.get('aula') || '');
  const [selectedDate, setSelectedDate] = useState(query.get('data') || '');
  const [selectedStart, setSelectedStart] = useState(query.get('inicio') || '');
  const [slots, setSlots] = useState([]);
  const [slotStatus, setSlotStatus] = useState(STATUS.EMPTY);
  const [slotError, setSlotError] = useState('');
  const [bookings, setBookings] = useState([]);
  const [bookingStatus, setBookingStatus] = useState(STATUS.LOADING);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [rescheduleFor, setRescheduleFor] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const slotsRequestId = useRef(0);

  const teacher = teachers.find((item) => item.slug === selectedTeacherSlug);
  const lessons = teacher?.lessons || [];
  const leadTime = teacher?.antecedencia_cancelamento_horas ?? 12;
  const selectedLesson = lessons.find((lesson) => lesson.aula_id === selectedLessonId);
  const availableDates = useMemo(() => [...new Set(slots.map((slot) => slot.date))], [slots]);

  const loadCatalog = useCallback(async () => {
    setPageStatus(STATUS.LOADING);
    setPageError('');

    const [teachersResult, lessonsResult, rulesResult] = await Promise.all([
      supabase.from('perfis_publicos').select('slug,nome').order('nome'),
      supabase.from('aulas_publicas').select('slug,aula_id,nome,duracao_min,preco').order('nome'),
      supabase.from('regras_agendamento_publicas').select('slug,antecedencia_cancelamento_horas'),
    ]);
    const error = teachersResult.error || lessonsResult.error || rulesResult.error;
    if (error) {
      setPageError(getSupabaseErrorMessage(error));
      setPageStatus(STATUS.ERROR);
      return;
    }

    const lessonsBySlug = new Map();
    for (const lesson of lessonsResult.data || []) {
      const teacherLessons = lessonsBySlug.get(lesson.slug) || [];
      teacherLessons.push(lesson);
      lessonsBySlug.set(lesson.slug, teacherLessons);
    }
    const rulesBySlug = new Map((rulesResult.data || []).map((rule) => [
      rule.slug,
      rule.antecedencia_cancelamento_horas,
    ]));
    const availableTeachers = (teachersResult.data || [])
      .map((item) => ({
        ...item,
        lessons: lessonsBySlug.get(item.slug) || [],
        antecedencia_cancelamento_horas: rulesBySlug.get(item.slug),
      }));
    if (availableTeachers.some((item) => item.antecedencia_cancelamento_horas == null)) {
      setPageError('Não foi possível carregar as regras de agendamento de todos os perfis.');
      setPageStatus(STATUS.ERROR);
      return;
    }
    const requestedTeacher = availableTeachers.find((item) => item.slug === getSlug());
    const initialTeacher = requestedTeacher || availableTeachers[0];
    const requestedLessonId = query.get('aula');

    setTeachers(availableTeachers);
    setSelectedTeacherSlug(initialTeacher?.slug || '');
    setSelectedLessonId(initialTeacher?.lessons.some((lesson) => lesson.aula_id === requestedLessonId)
      ? requestedLessonId
      : '');
    setPageStatus(availableTeachers.length ? STATUS.SUCCESS : STATUS.EMPTY);
  }, []);

  const loadSlots = useCallback(async (lessonId = selectedLessonId) => {
    const requestId = ++slotsRequestId.current;
    if (!lessonId || !teacher) {
      setSlots([]);
      setSlotStatus(STATUS.EMPTY);
      setSelectedDate('');
      setSelectedStart('');
      return [];
    }
    setSlotStatus(STATUS.LOADING);
    setSlotError('');
    try {
      const nextSlots = await queryAvailableSlots(teacher, lessonId, leadTime);
      if (requestId !== slotsRequestId.current) return [];
      setSlots(nextSlots);
      setSlotStatus(nextSlots.length ? STATUS.SUCCESS : STATUS.EMPTY);
      setSelectedDate((current) => nextSlots.some((slot) => slot.date === current) ? current : (nextSlots[0]?.date || ''));
      setSelectedStart((current) => nextSlots.some((slot) => slot.inicio === current) ? current : '');
      return nextSlots;
    } catch (error) {
      if (requestId !== slotsRequestId.current) return [];
      setSlotError(getSupabaseErrorMessage(error));
      setSlotStatus(STATUS.ERROR);
      return [];
    }
  }, [leadTime, teacher]);

  const loadBookings = useCallback(async () => {
    if (!user || role !== 'aluno') {
      setBookings([]);
      setBookingStatus(STATUS.EMPTY);
      return;
    }
    setBookingStatus(STATUS.LOADING);
    const { data, error } = await supabase.rpc('listar_meus_agendamentos');
    if (error) {
      setPageError(getSupabaseErrorMessage(error));
      setBookingStatus(STATUS.ERROR);
      return;
    }
    setBookings(data || []);
    setBookingStatus(data?.length ? STATUS.SUCCESS : STATUS.EMPTY);
  }, [role, user]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (teacher) loadSlots(selectedLessonId);
  }, [loadSlots, selectedLessonId, teacher]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  async function bookLesson(event) {
    event.preventDefault();
    if (!user || role !== 'aluno') {
      onRequireAuth({
        aulaId: selectedLessonId,
        date: selectedDate,
        inicio: selectedStart,
        professorSlug: teacher?.slug || '',
      });
      return;
    }
    if (!selectedLesson || !selectedStart || !consentAccepted) {
      setNotice('Escolha um horário e aceite o consentimento para continuar.');
      setNoticeIsError(true);
      return;
    }
    const selectedTime = slots.find((slot) => slot.inicio === selectedStart);
    setSubmitting(true);
    setNotice('');
    const { error } = await supabase.rpc('criar_agendamento', {
      p_slug: teacher.slug,
      p_aula_id: selectedLesson.aula_id,
      p_inicio: selectedStart,
      p_aceite_lgpd: true,
    });
    if (error) {
      setNotice(getSupabaseErrorMessage(error));
      setNoticeIsError(true);
      await loadSlots(selectedLessonId);
    } else {
      setSelectedStart('');
      setConsentAccepted(false);
      setNotice(`Aula ${selectedLesson.nome} confirmada com Professor(a) ${teacher.nome} para ${formatLocalDate(selectedDate, { dateStyle: 'medium' })} às ${selectedTime?.time || ''} · ${PRICE_FORMATTER.format(Number(selectedLesson.preco))}.`);
      setNoticeIsError(false);
      await Promise.all([loadSlots(selectedLessonId), loadBookings()]);
    }
    setSubmitting(false);
  }

  async function changeBooking(booking, action) {
    if (action === 'cancelar') {
      if (!window.confirm('Tem certeza que deseja cancelar esta aula?')) return;
      const { error } = await supabase.rpc('cancelar_agendamento', { p_agendamento_id: booking.id });
      if (error) {
        setNotice(getSupabaseErrorMessage(error));
        setNoticeIsError(true);
        return;
      }
      setNotice('Aula cancelada. O horário está livre novamente.');
      setNoticeIsError(false);
      await Promise.all([loadBookings(), loadSlots(selectedLessonId)]);
      return;
    }

    if (action === 'reagendar') {
      setRescheduleFor(booking.id);
      try {
        const nextSlots = await queryAvailableSlots(teacher, booking.aula_id, leadTime);
        const differentSlots = nextSlots.filter((slot) => slot.inicio !== booking.inicio);
        setRescheduleSlots(differentSlots);
        setRescheduleSlot(differentSlots[0]?.inicio || '');
      } catch (error) {
        setNotice(getSupabaseErrorMessage(error));
        setNoticeIsError(true);
        setRescheduleFor('');
      }
      return;
    }

    if (!rescheduleSlot) {
      setNotice('Escolha um novo horário disponível.');
      setNoticeIsError(true);
      return;
    }
    const { error } = await supabase.rpc('reagendar_agendamento', {
      p_agendamento_id: booking.id,
      p_novo_inicio: rescheduleSlot,
    });
    if (error) {
      setNotice(getSupabaseErrorMessage(error));
      setNoticeIsError(true);
      await loadSlots(booking.aula_id);
      return;
    }
    setRescheduleFor('');
    setRescheduleSlot('');
    setRescheduleSlots([]);
    setNotice('Aula reagendada.');
    setNoticeIsError(false);
    await loadBookings();
  }

  const pageErrorState = pageStatus === STATUS.ERROR;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-10">
      {pageErrorState ? (
        <ErrorState message={pageError} onRetry={loadCatalog} />
      ) : pageStatus === STATUS.LOADING ? (
        <LoadingState label="Carregando professores e aulas" />
      ) : (
        <>
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-accent">Agendamento</p>
              <h1 className="mt-1 text-2xl font-bold">Professores e aulas</h1>
              <p className="text-sm text-muted">Horários no fuso de São Paulo</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onBack}>{user && role === 'aluno' ? 'Minhas aulas' : 'Início'}</Button>
              {user && (
                <Button
                  variant="secondary"
                  onClick={role === 'aluno' ? () => onRequireAuth() : onOpenTeacherPanel}
                >
                  {role === 'aluno' ? 'Minha conta' : 'Acessar painel'}
                </Button>
              )}
            </div>
          </header>

          {notice && (
            <p className={`rounded-xl p-3 text-sm ${noticeIsError ? 'bg-rose-50 text-danger' : 'bg-emerald-50 text-emerald-900'}`} role={noticeIsError ? 'alert' : 'status'} aria-live={noticeIsError ? 'assertive' : 'polite'}>
              {notice}
            </p>
          )}

          {pageStatus === STATUS.EMPTY ? (
            <EmptyState title="Ainda não há perfis de Professor(a)" description="Quando houver perfis disponíveis, eles aparecerão aqui com suas aulas." />
          ) : (
            <>
              <Card>
                <h2 className="text-xl font-bold">Escolha um(a) Professor(a) e uma aula</h2>
                <label className="mt-4 block text-sm font-medium">
                  Professor(a)
                  <select
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
                    value={selectedTeacherSlug}
                    onChange={(event) => {
                      setSelectedTeacherSlug(event.target.value);
                      setSelectedLessonId('');
                      setSelectedDate('');
                      setSelectedStart('');
                    }}
                  >
                    {teachers.map((item) => (
                      <option key={item.slug} value={item.slug}>{item.nome}</option>
                    ))}
                  </select>
                </label>
                <h3 className="mt-5 font-semibold">Aulas oferecidas por {teacher?.nome}</h3>
                {lessons.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {lessons.map((lesson) => {
                      const selected = lesson.aula_id === selectedLessonId;
                      return (
                        <button
                          key={lesson.aula_id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedLessonId(lesson.aula_id);
                            setSelectedDate('');
                            setSelectedStart('');
                          }}
                          className={`min-h-20 rounded-xl border-2 p-4 text-left transition ${selected ? 'border-accent bg-cyan-50 ring-2 ring-accent/20' : 'border-border bg-surface hover:border-accent/60'}`}
                        >
                          <span className="block font-semibold">{lesson.nome}</span>
                          <span className="mt-1 block text-sm text-muted">{lesson.duracao_min} min · {PRICE_FORMATTER.format(Number(lesson.preco))}</span>
                          <span className="mt-2 inline-flex text-xs font-semibold text-accent">{selected ? 'Selecionada' : 'Escolher'}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted">Este(a) Professor(a) ainda não cadastrou aulas ativas para agendamento.</p>
                )}
              </Card>

              {lessons.length > 0 && (
                <>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">Horários disponíveis</h2>
                    <p className="text-sm text-muted">Escolha um dia e depois um horário.</p>
                  </div>
                  <Badge status="ativa">{availableDates.length} dias</Badge>
                </div>
                {slotStatus === STATUS.LOADING && <div className="mt-4"><LoadingState label="Buscando horários livres" rows={2} /></div>}
                {slotStatus === STATUS.ERROR && <div className="mt-4"><ErrorState message={slotError} onRetry={() => loadSlots(selectedLessonId)} /></div>}
                {slotStatus === STATUS.EMPTY && <p className="mt-4 text-sm text-muted">Não há horários livres nos próximos 14 dias.</p>}
                {slotStatus === STATUS.SUCCESS && (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {availableDates.map((date) => (
                        <button
                          key={date}
                          type="button"
                          aria-pressed={selectedDate === date}
                          onClick={() => { setSelectedDate(date); setSelectedStart(''); }}
                          className={`min-h-20 rounded-xl border-2 p-3 text-left ${selectedDate === date ? 'border-accent bg-accent text-white' : 'border-border bg-surface'}`}
                        >
                          <span className="block text-sm font-semibold capitalize">{getWeekday(date)}</span>
                          <span className="mt-1 block text-xs">{formatLocalDate(date, { day: 'numeric', month: 'short' })}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {slots.filter((slot) => slot.date === selectedDate).map((slot) => (
                        <button
                          key={slot.inicio}
                          type="button"
                          aria-pressed={selectedStart === slot.inicio}
                          onClick={() => setSelectedStart(slot.inicio)}
                          className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${selectedStart === slot.inicio ? 'border-accent bg-accent text-white' : 'border-border bg-surface hover:border-accent'}`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </Card>

              <Card>
                <h2 className="text-xl font-bold">Confirmar agendamento</h2>
                {user && role === 'aluno' ? (
                  <form className="mt-4 space-y-4" onSubmit={bookLesson}>
                    <p className="text-sm text-muted">Conta: {user.email}</p>
                    <label className="flex items-start gap-3 text-sm text-muted">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />
                      <span>Aceito o uso dos meus dados para gerenciar este agendamento (versão {PRIVACY_VERSION}).</span>
                    </label>
                    <Button type="submit" className="w-full" loading={submitting}>Confirmar aula</Button>
                  </form>
                ) : role === 'professora' ? (
                  <div className="mt-4">
                    <p className="text-sm text-muted">Você está conectado como Professor(a). Para reservar uma aula, saia dessa conta e entre ou crie uma conta de Aluno(a).</p>
                    <Button className="mt-4 w-full" onClick={() => onRequireAuth({ aulaId: selectedLessonId, date: selectedDate, inicio: selectedStart, professorSlug: teacher?.slug || '' })}>Sair e entrar como Aluno(a)</Button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm text-muted">Para confirmar a reserva e acompanhar suas aulas, entre ou crie uma conta de Aluno(a).</p>
                    <Button className="mt-4 w-full" onClick={() => onRequireAuth({ aulaId: selectedLessonId, date: selectedDate, inicio: selectedStart, professorSlug: teacher?.slug || '' })}>Entrar ou criar conta de Aluno(a)</Button>
                  </div>
                )}
              </Card>
                </>
              )}

              {role === 'aluno' && (
                <Card>
                  <h2 className="text-xl font-bold">Minhas aulas</h2>
                  {bookingStatus === STATUS.LOADING && <div className="mt-4"><LoadingState label="Carregando suas aulas" rows={2} /></div>}
                  {bookingStatus === STATUS.ERROR && <ErrorState message={pageError} onRetry={loadBookings} />}
                  {bookingStatus === STATUS.EMPTY && <p className="mt-3 text-sm text-muted">Você ainda não tem aulas agendadas.</p>}
                  {bookingStatus === STATUS.SUCCESS && (
                    <ul className="mt-4 space-y-3">
                      {bookings.map((booking) => {
                        const local = getLocalDateTime(booking.inicio);
                        const canChange = Date.now() <= new Date(booking.inicio).getTime()
                          - booking.antecedencia_cancelamento_horas * 60 * 60 * 1000;
                        return (
                          <li key={booking.id}>
                            <Card className="shadow-none">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-semibold">{booking.aula_nome}</h3>
                                  <p className="mt-1 text-sm text-muted">{formatLocalDate(local.date, { dateStyle: 'long' })} · {local.time}</p>
                                </div>
                                <Badge status={booking.status}>{booking.status}</Badge>
                              </div>
                              {['pendente', 'confirmado'].includes(booking.status) && canChange && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button variant="secondary" onClick={() => changeBooking(booking, 'cancelar')}>Cancelar</Button>
                                  <Button variant="secondary" onClick={() => changeBooking(booking, 'reagendar')}>Reagendar</Button>
                                </div>
                              )}
                              {['pendente', 'confirmado'].includes(booking.status) && !canChange && (
                                <p className="mt-3 text-sm text-muted">O prazo para alterar esta aula terminou.</p>
                              )}
                              {rescheduleFor === booking.id && (
                                <form
                                  className="mt-4 flex flex-col gap-3 sm:flex-row"
                                  onSubmit={(event) => { event.preventDefault(); changeBooking(booking, 'confirmar-reagendamento'); }}
                                >
                                  <select className="min-h-11 flex-1 rounded-xl border border-border px-3" value={rescheduleSlot} onChange={(event) => setRescheduleSlot(event.target.value)} aria-label="Novo horário">
                                    {rescheduleSlots.map((slot) => (
                                      <option key={slot.inicio} value={slot.inicio}>{formatLocalDate(slot.date, { dateStyle: 'medium' })} às {slot.time}</option>
                                    ))}
                                  </select>
                                  <Button type="submit">Confirmar novo horário</Button>
                                </form>
                              )}
                            </Card>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
