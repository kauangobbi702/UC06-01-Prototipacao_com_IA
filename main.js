import { supabase, supabaseConfigError } from './supabase.js';

const TIME_ZONE = 'America/Sao_Paulo';
const DEFAULT_TEACHER_SLUG = 'mariana-duarte';
const STUDENT = Object.freeze({
  name: 'Rafael Nogueira',
  email: 'rafael.nogueira@example.com',
});
const TOKEN_STORAGE_KEY = 'englishflow-booking-tokens';
const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const state = {
  view: 'login',
  authMode: 'login',
  user: null,
  teacher: null,
  publicTeacher: null,
  lessons: [],
  availability: [],
  blocks: [],
  teacherBookings: [],
  studentBookings: [],
  slots: [],
  selectedLessonId: '',
  selectedDate: '',
  selectedSlotId: '',
  editingBookingToken: '',
};

const $ = (selector) => document.querySelector(selector);
const views = ['login', 'professor', 'availability', 'agenda', 'aluno']
  .map((name) => $(`#${name === 'aluno' ? 'aluno' : name}-view`));
const appStatus = $('#app-status');
const formTeacherAuth = $('#form-professor-auth');
const teacherNameField = $('#teacher-name-field');
const teacherAuthError = $('#teacher-auth-error');
const formLesson = $('#form-aula-professor');
const lessonFormTitle = $('#lesson-form-title');
const lessonIdField = $('#lesson-id');
const lessonNameField = $('#professor-nome');
const lessonDurationField = $('#professor-duracao');
const lessonPriceField = $('#professor-preco');
const lessonFormSubmit = $('#lesson-form-submit');
const lessonFormCancel = $('#lesson-form-cancel');
const lessonList = $('#lista-aulas-professor');
const availabilityForm = $('#form-disponibilidade');
const availabilityList = $('#lista-disponibilidade');
const availabilityError = $('#erro-disponibilidade');
const blockForm = $('#form-bloqueio');
const blockDateField = $('#bloqueio-data');
const blockError = $('#erro-bloqueio');
const blockList = $('#lista-bloqueios');
const agendaList = $('#agenda-professor');
const lessonTypes = $('#lista-tipos-aula');
const availableDays = $('#lista-dias-disponiveis');
const availableTimes = $('#lista-horarios');
const studentForm = $('#form-agenda-aluno');
const selectedSlotSummary = $('#resumo-slot-selecionado');
const studentBookingsList = $('#lista-minhas-aulas');
const totalStudentBookings = $('#total-minhas-aulas');
const bookingDialog = $('#booking-dialog');
const bookingDialogContent = $('#booking-dialog-content');
const teacherSignupToggle = $('#toggle-teacher-signup');

function showStatus(message, isError = false) {
  appStatus.textContent = message;
  appStatus.classList.toggle('bg-error-50', isError);
  appStatus.classList.toggle('text-error-700', isError);
  appStatus.classList.toggle('bg-warning-50', !isError);
  appStatus.classList.toggle('text-warning-700', !isError);
  appStatus.hidden = !message;
}

function errorMessage(error) {
  const message = error?.message || 'Ocorreu um erro inesperado.';
  if (/hor.rio.*n.o dispon.vel|novo hor.rio n.o dispon.vel/i.test(message)) {
    return 'Esse horário não está mais disponível. Atualize a lista e escolha outro.';
  }
  if (/prazo.*encerrado/i.test(message)) {
    return 'O prazo para alterar esta aula já foi encerrado.';
  }
  if (/duplicate key|unique constraint/i.test(message)) {
    return 'Esse registro já existe. Confira os dados e tente novamente.';
  }
  if (/foreign key|violates.*constraint/i.test(message)) {
    return 'Não foi possível concluir porque este item está relacionado a um agendamento.';
  }
  return message;
}

function ensureDatabase() {
  if (supabase) return true;
  showStatus(supabaseConfigError, true);
  return false;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatPrice(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(value));
}

function localDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function localDateTimeParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function dateIso(date = new Date()) {
  const parts = localDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatLongDate(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-03:00`) : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatShortDate(value) {
  const date = new Date(`${value}T12:00:00-03:00`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, day: '2-digit', month: 'short' }).format(date);
}

function formatWeekday(value) {
  const date = new Date(`${value}T12:00:00-03:00`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, weekday: 'long' }).format(date);
}

function getLocalDateTime(value) {
  const parts = localDateTimeParts(value);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function getErrorText(error) {
  return errorMessage(error);
}

function readBookingTokens() {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '{}');
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch {
    throw new Error('Não foi possível ler os tokens de agendamento salvos neste navegador.');
  }
}

function saveBookingToken(slug, token) {
  const stored = readBookingTokens();
  const tokens = Array.isArray(stored[slug]) ? stored[slug] : [];
  if (!tokens.includes(token)) tokens.push(token);
  stored[slug] = tokens;
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(stored));
}

function removeBookingToken(slug, token) {
  const stored = readBookingTokens();
  stored[slug] = (Array.isArray(stored[slug]) ? stored[slug] : []).filter((item) => item !== token);
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(stored));
}

function teacherId() {
  if (!state.user?.id) throw new Error('Sessão da professora encerrada. Entre novamente.');
  return state.user.id;
}

function resetLessonForm() {
  formLesson.reset();
  lessonIdField.value = '';
  lessonFormTitle.textContent = 'Cadastrar nova aula';
  lessonFormSubmit.textContent = 'Salvar aula';
  lessonFormCancel.classList.add('hidden');
}

function slugify(name) {
  return name.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || DEFAULT_TEACHER_SLUG;
}

async function loadTeacherProfile(user, preferredName = '') {
  const { data: profile, error } = await supabase
    .from('perfis')
    .select('id,nome,slug,antecedencia_cancelamento_horas')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;

  if (profile) {
    state.teacher = profile;
    return profile;
  }

  const name = (preferredName || user.user_metadata?.nome || user.email?.split('@')[0] || 'Mariana Duarte').trim();
  const baseSlug = slugify(name);
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${user.id.replace(/-/g, '').slice(0, 6 + attempt)}`;
    const { data, error: insertError } = await supabase
      .from('perfis')
      .insert({ id: user.id, nome: name, slug })
      .select('id,nome,slug,antecedencia_cancelamento_horas')
      .single();
    if (!insertError) {
      state.teacher = data;
      return data;
    }
    lastError = insertError;
    if (insertError.code !== '23505') throw insertError;
  }
  throw lastError || new Error('Não foi possível criar o perfil da professora.');
}

async function loadTeacherData() {
  const ownerId = teacherId();
  const [lessonsResult, availabilityResult, blocksResult, bookingsResult] = await Promise.all([
    supabase.from('aulas')
      .select('id,nome,duracao_min,preco,ativo')
      .eq('professora_id', ownerId)
      .order('created_at', { ascending: true }),
    supabase.from('disponibilidades')
      .select('id,dia_semana,hora_inicio,hora_fim')
      .eq('professora_id', ownerId)
      .order('dia_semana')
      .order('hora_inicio'),
    supabase.from('bloqueios')
      .select('id,data,motivo')
      .eq('professora_id', ownerId)
      .gte('data', dateIso())
      .order('data'),
    supabase.from('agendamentos')
      .select('id,aula_id,aluno_nome,aluno_email,aluno_telefone,inicio,fim,duracao_min,status')
      .eq('professora_id', ownerId)
      .in('status', ['pendente', 'confirmado'])
      .order('inicio'),
  ]);
  for (const result of [lessonsResult, availabilityResult, blocksResult, bookingsResult]) {
    if (result.error) throw result.error;
  }

  state.lessons = lessonsResult.data.map((lesson) => ({
    id: lesson.id,
    name: lesson.nome,
    duration: lesson.duracao_min,
    price: Number(lesson.preco),
    active: lesson.ativo,
  }));
  state.availability = availabilityResult.data.map((item) => ({
    id: item.id,
    weekday: item.dia_semana,
    start: item.hora_inicio.slice(0, 5),
    end: item.hora_fim.slice(0, 5),
  }));
  state.blocks = blocksResult.data;
  state.teacherBookings = bookingsResult.data;
}

async function loadPublicTeacher(slug) {
  const { data: teacher, error: teacherError } = await supabase
    .from('perfis_publicos')
    .select('slug,nome')
    .eq('slug', slug)
    .maybeSingle();
  if (teacherError) throw teacherError;
  if (!teacher) {
    const message = slug === DEFAULT_TEACHER_SLUG
      ? 'Ainda não existe perfil para Mariana Duarte no banco. Crie a conta da professora primeiro e cadastre aulas e disponibilidade.'
      : 'Este link público não corresponde a uma professora cadastrada.';
    throw new Error(message);
  }

  const [lessonsResult, rulesResult] = await Promise.all([
    supabase.from('aulas_publicas')
      .select('aula_id,nome,duracao_min,preco')
      .eq('slug', teacher.slug)
      .order('nome'),
    supabase.from('regras_agendamento_publicas')
      .select('antecedencia_cancelamento_horas')
      .eq('slug', teacher.slug)
      .single(),
  ]);
  if (lessonsResult.error) throw lessonsResult.error;
  if (rulesResult.error) throw rulesResult.error;

  state.publicTeacher = { ...teacher, ...rulesResult.data };
  state.lessons = lessonsResult.data.map((lesson) => ({
    id: lesson.aula_id,
    name: lesson.nome,
    duration: lesson.duracao_min,
    price: Number(lesson.preco),
  }));
}

async function loadAvailableSlots() {
  state.slots = [];
  if (!state.publicTeacher || !state.selectedLessonId) {
    renderAvailableSlots();
    return;
  }

  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(`${dateIso()}T12:00:00-03:00`);
    date.setUTCDate(date.getUTCDate() + index);
    return dateIso(date);
  });
  const results = await Promise.all(dates.map((date) => supabase.rpc('listar_horarios_livres', {
    slug: state.publicTeacher.slug,
    aula_id: state.selectedLessonId,
    data: date,
  })));
  const threshold = Date.now() + (state.publicTeacher.antecedencia_cancelamento_horas || 12) * 60 * 60 * 1000;
  results.forEach((result, index) => {
    if (result.error) throw result.error;
    (result.data || []).forEach((row) => {
      if (new Date(row.inicio).getTime() < threshold) return;
      const local = getLocalDateTime(row.inicio);
      state.slots.push({
        id: row.inicio,
        start: row.inicio,
        end: row.fim,
        date: local.date || dates[index],
        time: local.time,
      });
    });
  });
  state.slots.sort((first, second) => new Date(first.start) - new Date(second.start));
  if (!state.slots.some((slot) => slot.id === state.selectedSlotId)) state.selectedSlotId = '';
  if (!state.slots.some((slot) => slot.date === state.selectedDate)) {
    state.selectedDate = state.slots[0]?.date || '';
  }
  renderAvailableSlots();
}

async function loadStudentBookings() {
  const storedTokens = readBookingTokens();
  const tokens = Array.isArray(storedTokens[state.publicTeacher.slug]) ? storedTokens[state.publicTeacher.slug] : [];
  const results = await Promise.all(tokens.map((token) => supabase.rpc('consultar_agendamento', { cancel_token: token })));
  state.studentBookings = results.map((result, index) => {
    if (result.error) throw result.error;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!row) return null;
    const local = getLocalDateTime(row.inicio);
    return {
      token: tokens[index],
      lessonId: row.aula_id,
      lessonName: row.aula_nome,
      price: Number(row.preco),
      start: row.inicio,
      end: row.fim,
      date: local.date,
      time: local.time,
      status: row.status,
    };
  }).filter(Boolean);
  state.studentBookings.sort((first, second) => new Date(first.start) - new Date(second.start));
}

function updateProfileLabels() {
  const name = state.teacher?.nome || 'Professora';
  ['#teacher-profile-name', '#availability-profile-name', '#agenda-profile-name'].forEach((selector) => {
    $(selector).textContent = name;
  });
  const publicUrl = new URL(window.location.href);
  publicUrl.search = '';
  publicUrl.searchParams.set('professora', state.teacher?.slug || DEFAULT_TEACHER_SLUG);
  $('#public-booking-link').href = publicUrl.toString();
  $('#student-teacher-name').textContent = state.publicTeacher ? `com ${state.publicTeacher.nome}` : 'com a professora';
}

async function navigateTo(view) {
  if (view !== 'login' && !ensureDatabase()) return;
  state.view = view;
  views.forEach((section) => section.classList.add('hidden'));
  showStatus('');

  if (view === 'login') {
    $('#login-view').classList.remove('hidden');
    return;
  }

  if (view === 'aluno') {
    $('#aluno-view').classList.remove('hidden');
    try {
      const slug = getPublicSlug();
      window.history.replaceState(null, '', publicUrlWithSlug(slug));
      await loadPublicTeacher(slug);
      updateProfileLabels();
      await renderStudent();
    } catch (error) {
      showStatus(getErrorText(error), true);
      lessonTypes.innerHTML = '<p class="text-sm text-muted">Não foi possível carregar as aulas.</p>';
      availableDays.innerHTML = '';
      availableTimes.innerHTML = '';
    }
    return;
  }

  if (!state.user || !state.teacher) {
    await navigateTo('login');
    return;
  }
  try {
    await loadTeacherData();
    updateProfileLabels();
    if (view === 'professor') {
      $('#professor-view').classList.remove('hidden');
      renderProfessor();
    } else if (view === 'availability') {
      $('#availability-view').classList.remove('hidden');
      renderAvailability();
    } else if (view === 'agenda') {
      $('#agenda-view').classList.remove('hidden');
      renderTeacherAgenda();
    }
  } catch (error) {
    showStatus(getErrorText(error), true);
  }
}

function renderAvailability() {
  const ordered = [...state.availability].sort((first, second) =>
    WEEKDAYS.findIndex((day) => day.value === first.weekday) - WEEKDAYS.findIndex((day) => day.value === second.weekday)
      || first.start.localeCompare(second.start));

  availabilityList.innerHTML = ordered.length
    ? ordered.map((item) => {
      const day = WEEKDAYS.find((candidate) => candidate.value === item.weekday);
      return `
        <div class="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3">
          <div>
            <p class="font-semibold text-text">${escapeHtml(day?.label || 'Dia')}</p>
            <p class="mt-1 text-sm text-muted">${escapeHtml(item.start)}–${escapeHtml(item.end)}</p>
          </div>
          <button type="button" class="btn-ghost min-h-[40px] px-3 text-error-700" data-remove-availability="${escapeHtml(item.id)}">Remover</button>
        </div>`;
    }).join('')
    : '<p class="rounded-xl bg-bg p-4 text-sm text-muted">Nenhuma faixa de horário cadastrada.</p>';

  blockList.innerHTML = state.blocks.length
    ? state.blocks.map((block) => `
        <div class="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3">
          <div>
            <p class="font-semibold text-text">${formatLongDate(block.data)}</p>
            <p class="mt-1 text-sm text-muted">${escapeHtml(block.motivo || 'Data bloqueada')}</p>
          </div>
          <button type="button" class="btn-ghost min-h-[40px] px-3 text-error-700" data-remove-block="${escapeHtml(block.id)}">Remover</button>
        </div>`).join('')
    : '<p class="text-sm text-muted">Nenhuma data bloqueada.</p>';
}

function renderProfessor() {
  $('#prazo-alteracao-horas').value = state.teacher.antecedencia_cancelamento_horas;
  $('#total-aulas-professor').textContent = state.lessons.length;
  lessonList.innerHTML = state.lessons.length
    ? state.lessons.map((lesson) => `
        <div class="rounded-xl border border-border bg-bg p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-semibold text-text">${escapeHtml(lesson.name)}</p>
              <p class="mt-1 text-sm text-muted">${lesson.duration} min · ${formatPrice(lesson.price)}</p>
            </div>
            <span class="rounded-full bg-success-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-success-800">${lesson.active ? 'Ativa' : 'Inativa'}</span>
          </div>
          <div class="mt-3 flex gap-2">
            <button type="button" class="btn-ghost flex-1" data-edit-lesson="${escapeHtml(lesson.id)}">Editar</button>
            <button type="button" class="btn-ghost flex-1 text-error-700" data-delete-lesson="${escapeHtml(lesson.id)}">Excluir</button>
          </div>
        </div>`).join('')
    : '<p class="text-sm text-muted">Nenhuma aula cadastrada. Cadastre uma para começar a receber agendamentos.</p>';

  $('#total-agendadas-professor').textContent = state.teacherBookings.filter((booking) => booking.status === 'confirmado').length;
}

function renderTeacherAgenda() {
  agendaList.innerHTML = state.teacherBookings.length
    ? state.teacherBookings.map((booking) => {
      const lesson = state.lessons.find((item) => item.id === booking.aula_id);
      const local = getLocalDateTime(booking.inicio);
      return `
        <div class="rounded-xl border border-border bg-bg p-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-semibold text-text">${escapeHtml(lesson?.name || 'Aula')}</p>
              <p class="mt-1 text-sm text-muted">${formatLongDate(local.date)} · ${local.time}</p>
            </div>
            <span class="rounded-full bg-primary-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">${booking.status === 'pendente' ? 'Pendente' : 'Confirmada'}</span>
          </div>
          <p class="mt-2 text-sm text-muted">Aluno: ${escapeHtml(booking.aluno_nome)} · ${escapeHtml(booking.aluno_email || booking.aluno_telefone)}</p>
          <div class="mt-3 flex gap-2">
            ${booking.status === 'pendente' ? `<button type="button" class="btn-accent flex-1" data-teacher-booking="confirmar" data-booking-id="${escapeHtml(booking.id)}">Confirmar</button>` : ''}
            ${booking.status === 'confirmado' ? `<button type="button" class="btn-ghost flex-1" data-teacher-booking="concluir" data-booking-id="${escapeHtml(booking.id)}">Marcar concluída</button>` : ''}
            <button type="button" class="btn-ghost flex-1 text-error-700" data-teacher-booking="cancelar" data-booking-id="${escapeHtml(booking.id)}">Cancelar</button>
          </div>
        </div>`;
    }).join('')
    : '<p class="text-sm text-muted">Nenhum agendamento ativo no momento.</p>';
}

function renderLessonTypes() {
  const activeLessons = state.lessons;
  if (!activeLessons.some((lesson) => lesson.id === state.selectedLessonId)) {
    state.selectedLessonId = activeLessons[0]?.id || '';
  }
  lessonTypes.innerHTML = activeLessons.length
    ? activeLessons.map((lesson) => {
      const selected = lesson.id === state.selectedLessonId;
      return `
        <button type="button" data-lesson-id="${escapeHtml(lesson.id)}" aria-pressed="${selected}" class="flex min-h-[76px] w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${selected ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border bg-surface hover:border-accent/60'}">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-accent text-white' : 'bg-accent/10 text-accent'}" aria-hidden="true">EN</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold text-text">${escapeHtml(lesson.name)}</span>
            <span class="mt-1 block text-sm text-muted">${lesson.duration} min · ${formatPrice(lesson.price)}</span>
          </span>
          <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${selected ? 'bg-accent text-white' : 'bg-bg text-muted'}">${selected ? 'Selecionada' : 'Escolher'}</span>
        </button>`;
    }).join('')
    : '<p class="text-sm text-muted">A professora ainda não cadastrou aulas disponíveis.</p>';
}

function renderAvailableSlots() {
  const dates = [...new Set(state.slots.map((slot) => slot.date))];
  if (!dates.includes(state.selectedDate)) state.selectedDate = dates[0] || '';
  $('#total-horarios').textContent = `${dates.length} ${dates.length === 1 ? 'dia' : 'dias'}`;
  availableDays.innerHTML = dates.length
    ? dates.map((date) => {
      const selected = date === state.selectedDate;
      const count = state.slots.filter((slot) => slot.date === date).length;
      return `
        <button type="button" data-available-date="${date}" aria-pressed="${selected}" aria-label="Selecionar ${formatWeekday(date)} ${formatShortDate(date)}, ${count} horários disponíveis" class="flex min-h-[96px] w-full flex-col items-start justify-between rounded-xl border-2 p-3 text-left transition ${selected ? 'border-accent bg-accent text-white shadow-md shadow-accent/20' : 'border-border bg-surface text-text hover:border-accent/60'}">
          <span class="flex w-full items-center justify-between gap-1">
            <span class="text-sm font-semibold capitalize">${formatWeekday(date)}</span>
            ${selected ? '<span aria-hidden="true">✓</span>' : ''}
          </span>
          <span class="text-sm ${selected ? 'text-white/90' : 'text-muted'}">${formatShortDate(date)}</span>
          <span class="text-xs font-medium ${selected ? 'text-white' : 'text-accent'}">${count} ${count === 1 ? 'horário livre' : 'horários livres'}</span>
        </button>`;
    }).join('')
    : '<p class="col-span-2 text-sm text-muted">Não há horários livres nos próximos 14 dias.</p>';

  const slotsOfDay = state.slots.filter((slot) => slot.date === state.selectedDate);
  availableTimes.innerHTML = slotsOfDay.length
    ? slotsOfDay.map((slot) => {
      const selected = slot.id === state.selectedSlotId;
      return `<button type="button" data-slot-id="${escapeHtml(slot.id)}" aria-pressed="${selected}" class="min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-semibold transition ${selected ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-text hover:border-accent'}">${slot.time}</button>`;
    }).join('')
    : '<p class="col-span-3 text-sm text-muted">Não há horários livres para este dia.</p>';
}

async function renderStudent() {
  renderLessonTypes();
  if (!state.selectedLessonId) {
    state.slots = [];
    renderAvailableSlots();
  } else {
    await loadAvailableSlots();
  }
  await loadStudentBookings();
  renderStudentBookings();
}

function renderStudentBookings() {
  const bookings = state.studentBookings;
  totalStudentBookings.textContent = bookings.length;
  studentBookingsList.innerHTML = bookings.length
    ? bookings.map((booking) => {
      const isActive = ['pendente', 'confirmado'].includes(booking.status);
      const inTime = (new Date(booking.start) - Date.now()) / 3600000;
      const canChange = isActive && inTime > (state.publicTeacher?.antecedencia_cancelamento_horas || 12);
      const status = booking.status === 'cancelado' ? 'Cancelada'
        : booking.status === 'concluido' ? 'Concluída'
          : booking.status === 'pendente' ? 'Pendente' : 'Confirmada';
      return `
        <div class="rounded-xl border border-border bg-bg p-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-semibold text-text">${escapeHtml(booking.lessonName)}</p>
              <p class="mt-1 text-sm text-muted">${formatLongDate(booking.date)} · ${booking.time}</p>
            </div>
            <span class="rounded-full bg-primary-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">${status}</span>
          </div>
          <p class="mt-2 text-sm text-muted">Professora ${escapeHtml(state.publicTeacher.nome)}</p>
          ${isActive ? `
            <div class="mt-3 flex gap-2">
              <button type="button" class="btn-ghost flex-1" data-student-action="cancelar" data-token="${escapeHtml(booking.token)}" ${canChange ? '' : 'disabled'}>${canChange ? 'Cancelar' : 'Prazo encerrado'}</button>
              <button type="button" class="btn-accent flex-1" data-student-action="reagendar" data-token="${escapeHtml(booking.token)}" ${canChange ? '' : 'disabled'}>${canChange ? 'Reagendar' : 'Prazo encerrado'}</button>
            </div>` : ''}
          <button type="button" class="mt-2 min-h-[40px] w-full rounded-xl px-3 text-sm text-error-700 hover:bg-error-50" data-student-action="excluir" data-token="${escapeHtml(booking.token)}">Excluir meus dados deste agendamento</button>
        </div>`;
    }).join('')
    : '<p class="text-sm text-muted">Ainda não há aulas agendadas neste navegador.</p>';
}

function getPublicSlug() {
  return new URLSearchParams(window.location.search).get('professora')?.trim().toLowerCase() || DEFAULT_TEACHER_SLUG;
}

function openDialog(content) {
  bookingDialogContent.innerHTML = content;
  bookingDialog.showModal();
}

function closeDialog() {
  if (bookingDialog.open) bookingDialog.close();
  state.editingBookingToken = '';
}

function openCancelDialog(booking) {
  const canChange = (new Date(booking.start) - Date.now()) / 3600000
    > (state.publicTeacher?.antecedencia_cancelamento_horas || 12);
  if (!canChange) {
    openDialog(`
      <h2 class="text-xl font-bold">Prazo de cancelamento encerrado</h2>
      <p class="mt-3 text-sm text-muted">O cancelamento deve ser feito com antecedência mínima de ${state.publicTeacher.antecedencia_cancelamento_horas || 12} horas.</p>
      <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Entendi</button>`);
    return;
  }
  openDialog(`
    <h2 class="text-xl font-bold">Cancelar aula?</h2>
    <p class="mt-3 text-sm text-muted">Tem certeza que deseja cancelar <strong>${escapeHtml(booking.lessonName)}</strong> em ${formatLongDate(booking.date)} às ${booking.time}?</p>
    <p class="mt-2 text-sm text-muted">O horário voltará a ficar disponível.</p>
    <div class="mt-5 flex gap-3">
      <button type="button" data-dialog-action="close" class="btn-ghost flex-1">Manter aula</button>
      <button type="button" data-dialog-action="confirm-cancel" data-token="${escapeHtml(booking.token)}" class="btn-primary flex-1">Confirmar cancelamento</button>
    </div>`);
}

async function openRescheduleDialog(booking) {
  if ((new Date(booking.start) - Date.now()) / 3600000
    <= (state.publicTeacher?.antecedencia_cancelamento_horas || 12)) {
    openDialog(`
      <h2 class="text-xl font-bold">Prazo de reagendamento encerrado</h2>
      <p class="mt-3 text-sm text-muted">O reagendamento deve ser feito com antecedência mínima de ${state.publicTeacher.antecedencia_cancelamento_horas || 12} horas.</p>
      <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Entendi</button>`);
    return;
  }

  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(`${dateIso()}T12:00:00-03:00`);
    date.setUTCDate(date.getUTCDate() + index);
    return dateIso(date);
  });
  const results = await Promise.all(dates.map((date) => supabase.rpc('listar_horarios_livres', {
    slug: state.publicTeacher.slug,
    aula_id: booking.lessonId,
    data: date,
  })));
  const slots = results.flatMap((result) => {
    if (result.error) throw result.error;
    return result.data || [];
  })
    .filter((slot) => slot.inicio !== booking.start
      && new Date(slot.inicio).getTime() > Date.now() + (state.publicTeacher.antecedencia_cancelamento_horas || 12) * 3600000)
    .map((slot) => ({ ...slot, ...getLocalDateTime(slot.inicio) }));
  if (!slots.length) {
    openDialog(`
      <h2 class="text-xl font-bold">Sem horários disponíveis nesta semana</h2>
      <p class="mt-3 text-sm text-muted">Tente novamente mais tarde ou fale com a professora.</p>
      <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Fechar</button>`);
    return;
  }
  state.editingBookingToken = booking.token;
  openDialog(`
    <h2 class="text-xl font-bold">Reagendar aula</h2>
    <p class="mt-2 text-sm text-muted">Escolha um novo horário. A reserva atual só será alterada após confirmar.</p>
    <label for="novo-horario" class="mt-4 block text-sm font-medium">Novo horário</label>
    <select id="novo-horario" class="campo">
      ${slots.map((slot) => `<option value="${escapeHtml(slot.inicio)}">${formatLongDate(slot.date)} às ${slot.time}</option>`).join('')}
    </select>
    <div class="mt-5 flex gap-3">
      <button type="button" data-dialog-action="close" class="btn-ghost flex-1">Voltar</button>
      <button type="button" data-dialog-action="confirm-reschedule" class="btn-accent flex-1">Confirmar novo horário</button>
    </div>`);
}

function showBookingConfirmation(booking, rescheduled = false) {
  openDialog(`
    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-800" aria-hidden="true">✓</div>
    <h2 class="mt-4 text-center text-xl font-bold">${rescheduled ? 'Reagendamento confirmado!' : 'Aula confirmada!'}</h2>
    <p class="mt-2 text-center text-sm text-muted">${escapeHtml(booking.lessonName)} com ${escapeHtml(state.publicTeacher.nome)}</p>
    <div class="mt-4 rounded-xl bg-bg p-4 text-sm">
      <p><strong>Data:</strong> ${formatLongDate(booking.date)}</p>
      <p class="mt-1"><strong>Horário:</strong> ${booking.time}</p>
      <p class="mt-1"><strong>Valor:</strong> ${formatPrice(booking.price)}</p>
    </div>
    <p class="mt-3 text-xs text-muted">A reserva e as notificações foram registradas no Supabase. O envio externo depende de um worker configurado.</p>
    <button type="button" data-dialog-action="close" class="btn-accent mt-5 w-full">Concluir</button>`);
}

async function handleTeacherAuth(event) {
  event.preventDefault();
  teacherAuthError.hidden = true;
  if (!ensureDatabase()) return;

  const formData = new FormData(formTeacherAuth);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const name = String(formData.get('nome') || '').trim();
  try {
    const result = state.authMode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { nome: name } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (!result.data.session || !result.data.user) {
      teacherAuthError.textContent = 'Conta criada. Confirme seu e-mail e depois entre para continuar.';
      teacherAuthError.hidden = false;
      return;
    }
    state.user = result.data.user;
    await loadTeacherProfile(state.user, name);
    await navigateTo('professor');
  } catch (error) {
    teacherAuthError.textContent = getErrorText(error);
    teacherAuthError.hidden = false;
  }
}

async function saveLesson(event) {
  event.preventDefault();
  const formData = new FormData(formLesson);
  const name = String(formData.get('nome') || '').trim();
  const duration = Number(formData.get('duracao'));
  const price = Number(formData.get('preco'));
  if (name.length < 3 || !Number.isInteger(duration) || duration < 15 || duration > 120 || !Number.isFinite(price) || price <= 0) {
    showStatus('Informe nome com pelo menos 3 caracteres, duração inteira entre 15 e 120 minutos e preço maior que zero.', true);
    return;
  }

  const id = String(formData.get('id') || '');
  const values = { nome: name, duracao_min: duration, preco: price.toFixed(2), ativo: true };
  const result = id
    ? await supabase.from('aulas').update(values).eq('id', id).eq('professora_id', teacherId())
    : await supabase.from('aulas').insert({ ...values, professora_id: teacherId() });
  if (result.error) throw result.error;
  showStatus(id ? 'Aula atualizada.' : 'Aula cadastrada.');
  resetLessonForm();
  await navigateTo('professor');
}

async function saveAvailability(event) {
  event.preventDefault();
  const formData = new FormData(availabilityForm);
  const weekday = Number(formData.get('weekday'));
  const start = String(formData.get('start') || '');
  const end = String(formData.get('end') || '');
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !start || !end || start >= end) {
    availabilityError.textContent = 'Escolha o dia e informe um horário final posterior ao horário inicial.';
    availabilityError.hidden = false;
    return;
  }
  const overlapping = state.availability.some((item) => item.weekday === weekday && start < item.end && item.start < end);
  if (overlapping) {
    availabilityError.textContent = 'Essa faixa se sobrepõe a outra disponibilidade cadastrada para o mesmo dia.';
    availabilityError.hidden = false;
    return;
  }

  const { error } = await supabase.from('disponibilidades').insert({
    professora_id: teacherId(),
    dia_semana: weekday,
    hora_inicio: start,
    hora_fim: end,
  });
  if (error) throw error;
  availabilityError.hidden = true;
  availabilityForm.reset();
  await navigateTo('availability');
}

async function saveBlock(event) {
  event.preventDefault();
  const formData = new FormData(blockForm);
  const date = String(formData.get('data') || '');
  if (!date || date < dateIso()) {
    blockError.textContent = 'Escolha uma data de hoje em diante.';
    blockError.hidden = false;
    return;
  }
  const { error } = await supabase.from('bloqueios').insert({
    professora_id: teacherId(),
    data: date,
    motivo: String(formData.get('motivo') || '').trim() || null,
  });
  if (error) {
    blockError.textContent = getErrorText(error);
    blockError.hidden = false;
    return;
  }
  blockError.hidden = true;
  blockForm.reset();
  await navigateTo('availability');
}

async function saveCancellationLeadTime(event) {
  event.preventDefault();
  const hours = Number(new FormData(event.currentTarget).get('horas'));
  if (!Number.isInteger(hours) || hours < 0 || hours > 72) {
    showStatus('Informe um prazo inteiro entre 0 e 72 horas.', true);
    return;
  }
  const { error } = await supabase.from('perfis')
    .update({ antecedencia_cancelamento_horas: hours })
    .eq('id', teacherId());
  if (error) throw error;
  state.teacher.antecedencia_cancelamento_horas = hours;
  showStatus('Prazo de alteração atualizado.');
}

async function bookStudentAppointment(event) {
  event.preventDefault();
  if (!state.selectedSlotId || !$('#consentimento-lgpd').checked) {
    showStatus('Escolha um horário e aceite o uso dos dados para confirmar o agendamento.', true);
    return;
  }
  const lesson = state.lessons.find((item) => item.id === state.selectedLessonId);
  const slot = state.slots.find((item) => item.id === state.selectedSlotId);
  if (!lesson || !slot) {
    await loadAvailableSlots();
    showStatus('O horário escolhido não está mais disponível. Selecione outro.', true);
    return;
  }

  const { data: token, error } = await supabase.rpc('criar_agendamento', {
    slug: state.publicTeacher.slug,
    aula_id: lesson.id,
    inicio: slot.start,
    aluno_nome: STUDENT.name,
    aluno_email: STUDENT.email,
    aluno_telefone: null,
    aceite_lgpd: true,
  });
  if (error) {
    await loadAvailableSlots();
    showStatus(getErrorText(error), true);
    return;
  }
  saveBookingToken(state.publicTeacher.slug, token);
  const booking = {
    token,
    lessonId: lesson.id,
    lessonName: lesson.name,
    price: lesson.price,
    start: slot.start,
    date: slot.date,
    time: slot.time,
  };
  state.selectedSlotId = '';
  $('#consentimento-lgpd').checked = false;
  await renderStudent();
  showBookingConfirmation(booking);
}

function openLessonForEdit(id) {
  const lesson = state.lessons.find((item) => item.id === id);
  if (!lesson) return;
  lessonIdField.value = lesson.id;
  lessonNameField.value = lesson.name;
  lessonDurationField.value = lesson.duration;
  lessonPriceField.value = lesson.price.toFixed(2);
  lessonFormTitle.textContent = 'Editar aula';
  lessonFormSubmit.textContent = 'Salvar alterações';
  lessonFormCancel.classList.remove('hidden');
  lessonNameField.focus();
}

async function handleDialogAction(action, button) {
  if (action === 'close') {
    closeDialog();
    return;
  }
  if (action === 'confirm-cancel') {
    const token = button.dataset.token;
    const { error } = await supabase.rpc('cancelar_agendamento', { cancel_token: token });
    if (error) throw error;
    removeBookingToken(state.publicTeacher.slug, token);
    closeDialog();
    await renderStudent();
    showStatus('Agendamento cancelado. O horário foi liberado.');
    return;
  }
  if (action === 'confirm-reschedule') {
    const newStart = $('#novo-horario')?.value;
    const token = state.editingBookingToken;
    if (!newStart || !token) throw new Error('Selecione um novo horário para continuar.');
    const { error } = await supabase.rpc('reagendar_agendamento', {
      cancel_token: token,
      novo_inicio: newStart,
    });
    if (error) throw error;
    closeDialog();
    await renderStudent();
    const updated = state.studentBookings.find((booking) => booking.token === token);
    if (updated) showBookingConfirmation(updated, true);
    return;
  }
  if (action === 'excluir') {
    const token = button.dataset.token;
    if (!window.confirm('Excluir permanentemente seus dados pessoais e este agendamento?')) return;
    const { error } = await supabase.rpc('excluir_dados_aluno', { cancel_token: token });
    if (error) throw error;
    removeBookingToken(state.publicTeacher.slug, token);
    closeDialog();
    await renderStudent();
    showStatus('Os dados deste agendamento foram excluídos.');
  }
}

function publicUrlWithSlug(slug) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('professora', slug);
  return url.toString();
}

$('#public-booking-link').addEventListener('click', (event) => {
  event.currentTarget.href = publicUrlWithSlug(state.teacher?.slug || DEFAULT_TEACHER_SLUG);
});

document.querySelectorAll('.role-button').forEach((button) => {
  button.addEventListener('click', async () => {
    if (button.dataset.role === 'professor') {
      if (!ensureDatabase()) return;
      $('#teacher-auth-card').classList.remove('hidden');
      $('#teacher-email').focus();
      return;
    }
    if (!ensureDatabase()) return;
    await navigateTo('aluno');
  });
});

teacherSignupToggle.addEventListener('click', () => {
  state.authMode = state.authMode === 'login' ? 'signup' : 'login';
  const isSignup = state.authMode === 'signup';
  $('#teacher-auth-title').textContent = isSignup ? 'Criar conta da professora' : 'Acesso da professora';
  $('#teacher-auth-submit').textContent = isSignup ? 'Criar conta' : 'Entrar';
  teacherSignupToggle.textContent = isSignup ? 'Já tenho uma conta' : 'Criar conta da professora';
  teacherNameField.hidden = !isSignup;
  $('#teacher-name').required = isSignup;
  $('#teacher-name').value = isSignup ? 'Mariana Duarte' : '';
  $('#teacher-password').autocomplete = isSignup ? 'new-password' : 'current-password';
  teacherAuthError.hidden = true;
});

formTeacherAuth.addEventListener('submit', handleTeacherAuth);
formLesson.addEventListener('submit', (event) => saveLesson(event).catch((error) => showStatus(getErrorText(error), true)));
lessonFormCancel.addEventListener('click', resetLessonForm);
lessonList.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit-lesson]');
  if (edit) {
    openLessonForEdit(edit.dataset.editLesson);
    return;
  }
  const remove = event.target.closest('[data-delete-lesson]');
  if (!remove || !window.confirm('Excluir esta aula? Agendamentos relacionados impedem a exclusão.')) return;
  try {
    const { error } = await supabase.from('aulas')
      .delete()
      .eq('id', remove.dataset.deleteLesson)
      .eq('professora_id', teacherId());
    if (error) throw error;
    await navigateTo('professor');
  } catch (error) {
    showStatus(getErrorText(error), true);
  }
});

availabilityForm.addEventListener('submit', (event) => saveAvailability(event).catch((error) => showStatus(getErrorText(error), true)));
availabilityList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-remove-availability]');
  if (!button) return;
  try {
    const { error } = await supabase.from('disponibilidades')
      .delete()
      .eq('id', button.dataset.removeAvailability)
      .eq('professora_id', teacherId());
    if (error) throw error;
    await navigateTo('availability');
  } catch (error) {
    showStatus(getErrorText(error), true);
  }
});

blockForm.addEventListener('submit', (event) => saveBlock(event).catch((error) => showStatus(getErrorText(error), true)));
$('#form-prazo-alteracao').addEventListener('submit', (event) => saveCancellationLeadTime(event).catch((error) => showStatus(getErrorText(error), true)));
blockList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-remove-block]');
  if (!button) return;
  try {
    const { error } = await supabase.from('bloqueios')
      .delete()
      .eq('id', button.dataset.removeBlock)
      .eq('professora_id', teacherId());
    if (error) throw error;
    await navigateTo('availability');
  } catch (error) {
    showStatus(getErrorText(error), true);
  }
});

agendaList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-teacher-booking]');
  if (!button) return;
  const status = {
    confirmar: 'confirmado',
    concluir: 'concluido',
    cancelar: 'cancelado',
  }[button.dataset.teacherBooking];
  try {
    const { error } = await supabase.from('agendamentos')
      .update({ status })
      .eq('id', button.dataset.bookingId)
      .eq('professora_id', teacherId());
    if (error) throw error;
    await navigateTo('agenda');
  } catch (error) {
    showStatus(getErrorText(error), true);
  }
});

$('#abrir-agenda-professor').addEventListener('click', () => navigateTo('agenda'));
$('#abrir-disponibilidade-card').addEventListener('click', () => navigateTo('availability'));
$('#voltar-professor').addEventListener('click', () => navigateTo('professor'));
$('#voltar-painel-agenda').addEventListener('click', () => navigateTo('professor'));
$('#logout-professor').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    showStatus(getErrorText(error), true);
    return;
  }
  state.user = null;
  state.teacher = null;
  await navigateTo('login');
});
$('#logout-aluno').addEventListener('click', () => {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState(null, '', url.toString());
  navigateTo('login');
});

lessonTypes.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-lesson-id]');
  if (!button || button.dataset.lessonId === state.selectedLessonId) return;
  state.selectedLessonId = button.dataset.lessonId;
  state.selectedDate = '';
  state.selectedSlotId = '';
  selectedSlotSummary.classList.add('hidden');
  try {
    renderLessonTypes();
    await loadAvailableSlots();
  } catch (error) {
    showStatus(getErrorText(error), true);
  }
});

availableDays.addEventListener('click', (event) => {
  const button = event.target.closest('[data-available-date]');
  if (!button) return;
  state.selectedDate = button.dataset.availableDate;
  state.selectedSlotId = '';
  selectedSlotSummary.classList.add('hidden');
  renderAvailableSlots();
});

availableTimes.addEventListener('click', (event) => {
  const button = event.target.closest('[data-slot-id]');
  if (!button) return;
  const slot = state.slots.find((item) => item.id === button.dataset.slotId);
  if (!slot) return;
  state.selectedSlotId = slot.id;
  selectedSlotSummary.textContent = `Horário selecionado: ${formatLongDate(slot.date)} às ${slot.time}`;
  selectedSlotSummary.classList.remove('hidden');
  renderAvailableSlots();
});

studentBookingsList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-student-action]');
  if (!button) return;
  const booking = state.studentBookings.find((item) => item.token === button.dataset.token);
  if (!booking) return;
  try {
    if (button.dataset.studentAction === 'cancelar') {
      openCancelDialog(booking);
    } else if (button.dataset.studentAction === 'excluir') {
      await handleDialogAction('excluir', button);
    } else {
      await openRescheduleDialog(booking);
    }
  } catch (error) {
    showStatus(getErrorText(error), true);
  }
});

studentForm.addEventListener('submit', (event) => bookStudentAppointment(event).catch((error) => showStatus(getErrorText(error), true)));

bookingDialog.addEventListener('click', async (event) => {
  if (event.target === bookingDialog) {
    closeDialog();
    return;
  }
  const button = event.target.closest('[data-dialog-action]');
  if (!button) return;
  try {
    await handleDialogAction(button.dataset.dialogAction, button);
  } catch (error) {
    closeDialog();
    showStatus(getErrorText(error), true);
  }
});

bookingDialog.addEventListener('close', () => {
  state.editingBookingToken = '';
});

$('#teacher-email').value = '';
$('#teacher-name').value = 'Mariana Duarte';
$('#student-fixed-name').textContent = STUDENT.name;
$('#student-fixed-contact').textContent = STUDENT.email;
blockDateField.min = dateIso();

async function startApplication() {
  if (!supabase) {
    await navigateTo('login');
    showStatus(supabaseConfigError, true);
    return;
  }

  const requestedSlug = new URLSearchParams(window.location.search).get('professora');
  if (requestedSlug) {
    await navigateTo('aluno');
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showStatus(getErrorText(error), true);
    await navigateTo('login');
    return;
  }
  if (data.session?.user) {
    state.user = data.session.user;
    try {
      await loadTeacherProfile(state.user);
      await navigateTo('professor');
      return;
    } catch (profileError) {
      showStatus(getErrorText(profileError), true);
    }
  }
  await navigateTo('login');
}

startApplication().catch((error) => showStatus(getErrorText(error), true));
