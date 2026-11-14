const STORAGE_KEYS = {
  lessons: 'englishflow-lessons',
  bookings: 'englishflow-bookings',
  availability: 'englishflow-weekly-availability',
  activeStudentContact: 'englishflow-active-student-contact',
};
const PROFESSORA = 'Mariana Duarte';
const DIAS_SEMANA = [
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
  selectedLessonId: '',
  selectedDate: '',
  selectedSlotId: '',
  editingBookingId: '',
};

const loginView = document.querySelector('#login-view');
const professorView = document.querySelector('#professor-view');
const availabilityView = document.querySelector('#availability-view');
const agendaView = document.querySelector('#agenda-view');
const alunoView = document.querySelector('#aluno-view');
const totalAulasProfessor = document.querySelector('#total-aulas-professor');
const listaAulasProfessor = document.querySelector('#lista-aulas-professor');
const totalAgendadasProfessor = document.querySelector('#total-agendadas-professor');
const agendaProfessor = document.querySelector('#agenda-professor');
const formAulaProfessor = document.querySelector('#form-aula-professor');
const listaTiposAula = document.querySelector('#lista-tipos-aula');
const listaDiasDisponiveis = document.querySelector('#lista-dias-disponiveis');
const listaHorarios = document.querySelector('#lista-horarios');
const formAgendaAluno = document.querySelector('#form-agenda-aluno');
const resumoSlotSelecionado = document.querySelector('#resumo-slot-selecionado');
const listaMinhasAulas = document.querySelector('#lista-minhas-aulas');
const totalMinhasAulas = document.querySelector('#total-minhas-aulas');
const totalHorarios = document.querySelector('#total-horarios');
const bookingDialog = document.querySelector('#booking-dialog');
const bookingDialogContent = document.querySelector('#booking-dialog-content');
const campoContatoAluno = document.querySelector('#aluno-contato');
const erroContatoAluno = document.querySelector('#erro-contato');
const formDisponibilidade = document.querySelector('#form-disponibilidade');
const listaDisponibilidade = document.querySelector('#lista-disponibilidade');
const erroDisponibilidade = document.querySelector('#erro-disponibilidade');

function formatarPreco(centavos) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100);
}

function gerarId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function obterDataISO(diasAFrente = 0) {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + diasAFrente);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarDiaSemana(dataISO) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(`${dataISO}T12:00:00`));
}

function formatarDataCurta(dataISO) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${dataISO}T12:00:00`));
}

function formatarDataLonga(dataISO) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${dataISO}T12:00:00`));
}

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[caractere]);
}

function contatoValido(contato) {
  const valor = contato.trim();
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  const digitos = valor.replace(/\D/g, '');
  return emailValido || (digitos.length >= 10 && digitos.length <= 15);
}

function dentroDoPrazoMinimo(slot) {
  const horario = new Date(`${slot.date}T${slot.time}:00`);
  return horario.getTime() - Date.now() >= 12 * 60 * 60 * 1000;
}

function horariosBase() {
  const horarios = [];
  [1, 2, 3, 4, 5].forEach((weekday) => {
    horarios.push(
      { id: gerarId('availability'), weekday, start: '09:00', end: '12:00' },
      { id: gerarId('availability'), weekday, start: '14:00', end: '18:00' },
    );
  });
  return horarios;
}

function lerStorage(chave, fallback) {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : fallback;
  } catch {
    return fallback;
  }
}

function salvarStorage(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

function criarDadosBase() {
  const lessons = [
    { id: 'lesson-1', name: 'Conversação individual', duration_minutes: 50, price_cents: 4900, created_at: new Date().toISOString() },
    { id: 'lesson-2', name: 'Speaking for travel', duration_minutes: 30, price_cents: 3900, created_at: new Date().toISOString() },
    { id: 'lesson-3', name: 'IELTS prep', duration_minutes: 60, price_cents: 7900, created_at: new Date().toISOString() },
  ];
  const bookings = [];

  salvarStorage(STORAGE_KEYS.lessons, lessons);
  salvarStorage(STORAGE_KEYS.availability, horariosBase());
  salvarStorage(STORAGE_KEYS.bookings, bookings);
}

function obterLessons() {
  const lessons = lerStorage(STORAGE_KEYS.lessons, []);
  if (!lessons.length) {
    criarDadosBase();
    return lerStorage(STORAGE_KEYS.lessons, []);
  }
  return lessons;
}

function obterBookings() {
  return lerStorage(STORAGE_KEYS.bookings, []);
}

function obterAvailability() {
  const horarios = lerStorage(STORAGE_KEYS.availability, null);
  if (Array.isArray(horarios)) return horarios;

  const horariosIniciais = horariosBase();
  guardarAvailability(horariosIniciais);
  return horariosIniciais;
}

function guardarLessons(lessons) {
  salvarStorage(STORAGE_KEYS.lessons, lessons);
}

function guardarBookings(bookings) {
  salvarStorage(STORAGE_KEYS.bookings, bookings);
}

function guardarAvailability(horarios) {
  salvarStorage(STORAGE_KEYS.availability, horarios);
}

function minutosDoDia(hora) {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

function horaValida(hora) {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  const [horas, minutos] = hora.split(':').map(Number);
  return horas >= 0 && horas <= 23 && minutos >= 0 && minutos <= 59;
}

function formatarHora(minutos) {
  const horas = String(Math.floor(minutos / 60)).padStart(2, '0');
  const restante = String(minutos % 60).padStart(2, '0');
  return `${horas}:${restante}`;
}

function duracaoAgendamento(booking) {
  return booking.duration_minutes || obterLessonPorId(booking.lessonId)?.duration_minutes || 30;
}

function horarioConflitaComAgendamento(data, hora, duracao, booking, ignoreBookingId = '') {
  if (booking.status !== 'confirmed' || booking.id === ignoreBookingId) return false;

  const inicioNovo = new Date(`${data}T${hora}:00`).getTime();
  const fimNovo = inicioNovo + duracao * 60 * 1000;
  const inicioExistente = new Date(`${booking.date}T${booking.time}:00`).getTime();
  const fimExistente = inicioExistente + duracaoAgendamento(booking) * 60 * 1000;
  return inicioNovo < fimExistente && inicioExistente < fimNovo;
}

function gerarHorariosDisponiveis(lesson, ignoreBookingId = '') {
  if (!lesson) return [];

  const janelas = obterAvailability();
  const agendamentos = obterBookings();
  const horarios = new Map();

  for (let offset = 1; offset <= 14; offset += 1) {
    const date = obterDataISO(offset);
    const weekday = new Date(`${date}T12:00:00`).getDay();

    janelas.filter((janela) => janela.weekday === weekday).forEach((janela) => {
      const inicio = minutosDoDia(janela.start);
      const fim = minutosDoDia(janela.end);
      for (let minuto = inicio; minuto + lesson.duration_minutes <= fim; minuto += 30) {
        const time = formatarHora(minuto);
        const slot = {
          id: `slot-${date}-${time.replace(':', '')}`,
          date,
          time,
          lessonId: lesson.id,
        };
        const ocupado = agendamentos.some((booking) =>
          horarioConflitaComAgendamento(date, time, lesson.duration_minutes, booking, ignoreBookingId));

        if (dentroDoPrazoMinimo(slot) && !ocupado) {
          horarios.set(slot.id, slot);
        }
      }
    });
  }

  return [...horarios.values()].sort((a, b) =>
    new Date(`${a.date}T${a.time}:00`) - new Date(`${b.date}T${b.time}:00`));
}

function obterLessonPorId(id) {
  return obterLessons().find((lesson) => lesson.id === id) || null;
}

function navegarPara(role) {
  state.view = role;
  loginView.classList.add('hidden');
  professorView.classList.add('hidden');
  availabilityView.classList.add('hidden');
  agendaView.classList.add('hidden');
  alunoView.classList.add('hidden');

  if (role === 'professor') {
    professorView.classList.remove('hidden');
    renderProfessor();
  } else if (role === 'availability') {
    availabilityView.classList.remove('hidden');
    renderDisponibilidade();
  } else if (role === 'agenda') {
    agendaView.classList.remove('hidden');
    renderAgendaProfessor();
  } else if (role === 'aluno') {
    alunoView.classList.remove('hidden');
    renderAluno();
  } else {
    loginView.classList.remove('hidden');
  }
}

function renderDisponibilidade() {
  const horarios = obterAvailability().sort((a, b) =>
    DIAS_SEMANA.findIndex((dia) => dia.value === a.weekday) - DIAS_SEMANA.findIndex((dia) => dia.value === b.weekday)
      || a.start.localeCompare(b.start));

  listaDisponibilidade.innerHTML = horarios.length
    ? horarios.map((janela) => {
        const dia = DIAS_SEMANA.find((item) => item.value === janela.weekday);
        return `
          <div class="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3">
            <div>
              <p class="font-semibold text-text">${escaparHtml(dia?.label || 'Dia')}</p>
              <p class="mt-1 text-sm text-muted">${escaparHtml(janela.start)}–${escaparHtml(janela.end)}</p>
            </div>
            <button type="button" class="btn-ghost min-h-[40px] px-3 text-error-700" data-remove-availability="${escaparHtml(janela.id)}" aria-label="Remover disponibilidade de ${escaparHtml(dia?.label || 'dia')} das ${escaparHtml(janela.start)} às ${escaparHtml(janela.end)}">Remover</button>
          </div>
        `;
      }).join('')
    : '<p class="rounded-xl bg-bg p-4 text-sm text-muted">Nenhuma faixa de horário cadastrada. Adicione uma faixa para que os alunos possam ver horários livres.</p>';
}

function adicionarDisponibilidade(event) {
  event.preventDefault();
  const dados = new FormData(formDisponibilidade);
  const weekday = Number(dados.get('weekday'));
  const start = String(dados.get('start') || '');
  const end = String(dados.get('end') || '');
  const inicio = minutosDoDia(start);
  const fim = minutosDoDia(end);

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6
    || !horaValida(start) || !horaValida(end) || inicio >= fim) {
    erroDisponibilidade.textContent = 'Escolha o dia e informe um horário final posterior ao horário inicial.';
    erroDisponibilidade.hidden = false;
    return;
  }

  const horarios = obterAvailability();
  const temSobreposicao = horarios.some((janela) =>
    janela.weekday === weekday && inicio < minutosDoDia(janela.end) && minutosDoDia(janela.start) < fim);

  if (temSobreposicao) {
    erroDisponibilidade.textContent = 'Essa faixa se sobrepõe a outra disponibilidade cadastrada para o mesmo dia.';
    erroDisponibilidade.hidden = false;
    return;
  }

  horarios.push({ id: gerarId('availability'), weekday, start, end });
  guardarAvailability(horarios);
  erroDisponibilidade.hidden = true;
  formDisponibilidade.reset();
  renderDisponibilidade();
}

listaDisponibilidade.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-availability]');
  if (!button) return;

  const horarios = obterAvailability().filter((janela) => janela.id !== button.dataset.removeAvailability);
  guardarAvailability(horarios);
  renderDisponibilidade();
});

function renderProfessor() {
  const lessons = obterLessons();
  totalAulasProfessor.textContent = lessons.length;
  listaAulasProfessor.innerHTML = lessons.length
    ? lessons.map((lesson) => `
        <div class="rounded-xl border border-border bg-bg p-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-semibold text-text">${escaparHtml(lesson.name)}</p>
              <p class="mt-1 text-sm text-muted">${lesson.duration_minutes} min · ${formatarPreco(lesson.price_cents)}</p>
            </div>
            <span class="rounded-full bg-success-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-success-800">Ativa</span>
          </div>
        </div>
      `).join('')
    : '<p class="text-sm text-muted">Nenhuma aula cadastrada.</p>';

  totalAgendadasProfessor.textContent = obterBookings()
    .filter((booking) => booking.status === 'confirmed').length;
}

function renderAgendaProfessor() {
  const bookings = obterBookings()
    .filter((booking) => booking.status === 'confirmed')
    .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

  agendaProfessor.innerHTML = bookings.length
    ? bookings.map((booking) => {
        const lesson = obterLessonPorId(booking.lessonId);
        return `
          <div class="rounded-xl border border-border bg-bg p-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-semibold text-text">${escaparHtml(lesson ? lesson.name : 'Aula')}</p>
                <p class="mt-1 text-sm text-muted">${formatarDataLonga(booking.date)} · ${booking.time}</p>
              </div>
              <span class="rounded-full bg-primary-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">Confirmada</span>
            </div>
            <p class="mt-2 text-sm text-muted">Aluno: ${escaparHtml(booking.studentName)} · ${escaparHtml(booking.contact)}</p>
          </div>
        `;
      }).join('')
    : '<p class="text-sm text-muted">Nenhum agendamento confirmado ainda.</p>';
}

function renderAluno() {
  const lessons = obterLessons();
  const selected = state.selectedLessonId || lessons[0]?.id || '';
  state.selectedLessonId = selected;
  if (!campoContatoAluno.value) {
    campoContatoAluno.value = lerStorage(STORAGE_KEYS.activeStudentContact, '');
  }

  listaTiposAula.innerHTML = lessons.map((lesson) => {
    const selecionada = lesson.id === selected;
    return `
      <button
        type="button"
        data-lesson-id="${escaparHtml(lesson.id)}"
        aria-pressed="${selecionada}"
        class="flex min-h-[76px] w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${selecionada ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border bg-surface hover:border-accent/60'}"
      >
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selecionada ? 'bg-accent text-white' : 'bg-accent/10 text-accent'}" aria-hidden="true">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-semibold text-text">${escaparHtml(lesson.name)}</span>
          <span class="mt-1 block text-sm text-muted">${lesson.duration_minutes} min · ${formatarPreco(lesson.price_cents)}</span>
        </span>
        <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${selecionada ? 'bg-accent text-white' : 'bg-bg text-muted'}">${selecionada ? 'Selecionada' : 'Escolher'}</span>
      </button>
    `;
  }).join('');

  const lesson = obterLessonPorId(selected);
  const slots = gerarHorariosDisponiveis(lesson);
  const datas = [...new Set(slots.map((slot) => slot.date))];
  if (!datas.includes(state.selectedDate)) {
    state.selectedDate = datas[0] || '';
  }
  totalHorarios.textContent = `${datas.length} ${datas.length === 1 ? 'dia' : 'dias'}`;

  listaDiasDisponiveis.innerHTML = datas.map((date) => {
    const selecionado = date === state.selectedDate;
    const quantidade = slots.filter((slot) => slot.date === date).length;
    return `
      <button
        type="button"
        data-available-date="${date}"
        aria-pressed="${selecionado}"
        aria-label="Selecionar ${formatarDiaSemana(date)} ${formatarDataCurta(date)}, ${quantidade} horários disponíveis"
        class="flex min-h-[96px] w-full flex-col items-start justify-between rounded-xl border-2 p-3 text-left transition ${selecionado ? 'border-accent bg-accent text-white shadow-md shadow-accent/20' : 'border-border bg-surface text-text hover:border-accent/60'}"
      >
        <span class="flex w-full items-center justify-between gap-1">
          <span class="text-sm font-semibold capitalize">${formatarDiaSemana(date)}</span>
          ${selecionado ? '<svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>' : ''}
        </span>
        <span class="text-sm ${selecionado ? 'text-white/90' : 'text-muted'}">${formatarDataCurta(date)}</span>
        <span class="text-xs font-medium ${selecionado ? 'text-white' : 'text-accent'}">${quantidade} ${quantidade === 1 ? 'horário livre' : 'horários livres'}</span>
      </button>
    `;
  }).join('');

  const horariosDoDia = slots.filter((slot) => slot.date === state.selectedDate);
  listaHorarios.innerHTML = horariosDoDia.length
    ? horariosDoDia.map((slot) => {
        const selecionado = slot.id === state.selectedSlotId;
        return `
          <button
            type="button"
            data-slot-id="${slot.id}"
            aria-pressed="${selecionado}"
            class="min-h-11 rounded-xl border-2 px-2 py-2 text-sm font-semibold transition ${selecionado ? 'border-accent bg-accent text-white' : 'border-border bg-surface text-text hover:border-accent'}"
          >${slot.time}</button>
        `;
      }).join('')
    : '<p class="col-span-3 text-sm text-muted">Não há horários livres para este dia.</p>';

  listaDiasDisponiveis.querySelectorAll('[data-available-date]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.availableDate === state.selectedDate) return;
      state.selectedDate = button.dataset.availableDate;
      state.selectedSlotId = '';
      resumoSlotSelecionado.classList.add('hidden');
      renderAluno();
      listaDiasDisponiveis.querySelector(`[data-available-date="${state.selectedDate}"]`)?.focus();
    });
  });

  listaHorarios.querySelectorAll('[data-slot-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const slot = slots.find((item) => item.id === button.dataset.slotId);
      if (!slot) return;
      state.selectedSlotId = slot.id;
      state.selectedDate = slot.date;
      resumoSlotSelecionado.textContent = `Horário selecionado: ${formatarDataLonga(slot.date)} às ${slot.time}`;
      resumoSlotSelecionado.classList.remove('hidden');
      listaHorarios.querySelectorAll('[data-slot-id]').forEach((item) => {
        const selecionado = item === button;
        item.setAttribute('aria-pressed', String(selecionado));
        item.classList.toggle('border-accent', selecionado);
        item.classList.toggle('bg-accent', selecionado);
        item.classList.toggle('text-white', selecionado);
        item.classList.toggle('border-border', !selecionado);
        item.classList.toggle('bg-surface', !selecionado);
        item.classList.toggle('text-text', !selecionado);
      });
    });
  });

  renderMinhasAulas();
}

function renderMinhasAulas() {
  const contatoAtivo = campoContatoAluno.value.trim();
  const contatoKey = normalizarContato(contatoAtivo);
  const bookings = obterBookings()
    .filter((booking) => booking.status === 'confirmed' && normalizarContato(booking.contact) === contatoKey && contatoKey)
    .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

  totalMinhasAulas.textContent = bookings.length;

  listaMinhasAulas.innerHTML = bookings.length
    ? bookings.map((booking) => {
        const lesson = obterLessonPorId(booking.lessonId);
        const slotDate = new Date(`${booking.date}T${booking.time}:00`);
        const now = new Date();
        const diffHoras = (slotDate - now) / (1000 * 60 * 60);
        const podeAlterar = diffHoras > 12;

        return `
          <div class="rounded-xl border border-border bg-bg p-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="font-semibold text-text">${escaparHtml(lesson ? lesson.name : 'Aula')}</p>
                <p class="mt-1 text-sm text-muted">${formatarDataLonga(booking.date)} · ${booking.time}</p>
              </div>
              <span class="rounded-full bg-primary-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">Confirmada</span>
            </div>
            <p class="mt-2 text-sm text-muted">Professora ${PROFESSORA}</p>
            <div class="mt-3 flex gap-2">
              <button type="button" class="cancel-booking btn-ghost flex-1" data-booking-id="${escaparHtml(booking.id)}" ${podeAlterar ? '' : 'disabled'}>
                ${podeAlterar ? 'Cancelar' : 'Prazo encerrado'}
              </button>
              <button type="button" class="reschedule-booking btn-accent flex-1" data-booking-id="${escaparHtml(booking.id)}" ${podeAlterar ? '' : 'disabled'} title="${podeAlterar ? 'Reagendar' : 'Fora do prazo de 12h'}">
                ${podeAlterar ? 'Reagendar' : 'Prazo encerrado'}
              </button>
            </div>
          </div>
        `;
      }).join('')
    : `<p class="text-sm text-muted">${contatoKey ? 'Nenhuma aula confirmada para este contato.' : 'Informe o e-mail ou WhatsApp usado no agendamento para consultar suas aulas.'}</p>`;

  listaMinhasAulas.querySelectorAll('.cancel-booking').forEach((button) => {
    button.addEventListener('click', () => {
      const booking = obterBookings().find((item) => item.id === button.dataset.bookingId);
      if (!booking) return;
      abrirDialogoCancelamento(booking);
    });
  });

  listaMinhasAulas.querySelectorAll('.reschedule-booking').forEach((button) => {
    button.addEventListener('click', () => {
      const bookingId = button.dataset.bookingId;
      const booking = obterBookings().find((item) => item.id === bookingId);
      if (!booking) return;
      abrirDialogoReagendamento(booking);
    });
  });
}

function normalizarContato(contato) {
  const valor = contato.trim();
  return valor.includes('@') ? valor.toLowerCase() : valor.replace(/\D/g, '');
}

function abrirDialogo(conteudo) {
  bookingDialogContent.innerHTML = conteudo;
  bookingDialog.showModal();
}

function fecharDialogo() {
  if (bookingDialog.open) bookingDialog.close();
  state.editingBookingId = '';
}

function abrirDialogoCancelamento(booking) {
  const lesson = obterLessonPorId(booking.lessonId);
  const horasAteAula = (new Date(`${booking.date}T${booking.time}:00`) - new Date()) / (1000 * 60 * 60);
  if (horasAteAula <= 12) {
    abrirDialogo(`
      <h2 class="text-xl font-bold">Prazo de cancelamento encerrado</h2>
      <p class="mt-3 text-sm text-muted">O cancelamento só pode ser feito até 12 horas antes da aula. Para falar com a professora ${PROFESSORA}, entre em contato pelo canal informado por ela.</p>
      <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Entendi</button>
    `);
    return;
  }

  abrirDialogo(`
    <h2 class="text-xl font-bold">Cancelar aula?</h2>
    <p class="mt-3 text-sm text-muted">Tem certeza que deseja cancelar <strong>${escaparHtml(lesson?.name || 'a aula')}</strong> em ${formatarDataLonga(booking.date)} às ${escaparHtml(booking.time)}?</p>
    <p class="mt-2 text-sm text-muted">O horário voltará a ficar disponível para outros alunos.</p>
    <div class="mt-5 flex gap-3">
      <button type="button" data-dialog-action="close" class="btn-ghost flex-1">Manter aula</button>
      <button type="button" data-dialog-action="confirm-cancel" data-booking-id="${escaparHtml(booking.id)}" class="btn-primary flex-1">Confirmar cancelamento</button>
    </div>
  `);
}

function obterHorariosLivres(booking) {
  return gerarHorariosDisponiveis(obterLessonPorId(booking.lessonId), booking.id)
    .filter((slot) => slot.id !== booking.slotId);
}

function abrirDialogoReagendamento(booking) {
  const horasAteAula = (new Date(`${booking.date}T${booking.time}:00`) - new Date()) / (1000 * 60 * 60);
  if (horasAteAula <= 12) {
    abrirDialogo(`
      <h2 class="text-xl font-bold">Prazo de reagendamento encerrado</h2>
      <p class="mt-3 text-sm text-muted">O reagendamento só pode ser feito até 12 horas antes da aula. Para falar com a professora ${PROFESSORA}, entre em contato pelo canal informado por ela.</p>
      <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Entendi</button>
    `);
    return;
  }

  const livres = obterHorariosLivres(booking);
  if (!livres.length) {
    abrirDialogo(`
      <h2 class="text-xl font-bold">Sem horários disponíveis</h2>
      <p class="mt-3 text-sm text-muted">Não há outro horário livre para esta aula no momento.</p>
      <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Fechar</button>
    `);
    return;
  }

  state.editingBookingId = booking.id;
  abrirDialogo(`
    <h2 class="text-xl font-bold">Reagendar aula</h2>
    <p class="mt-2 text-sm text-muted">Escolha um novo horário. A reserva atual só será alterada após confirmar.</p>
    <label for="novo-horario" class="mt-4 block text-sm font-medium">Novo horário</label>
    <select id="novo-horario" class="campo">
      ${livres.map((slot) => `<option value="${escaparHtml(slot.id)}">${formatarDataLonga(slot.date)} às ${escaparHtml(slot.time)}</option>`).join('')}
    </select>
    <div class="mt-5 flex gap-3">
      <button type="button" data-dialog-action="close" class="btn-ghost flex-1">Voltar</button>
      <button type="button" data-dialog-action="confirm-reschedule" class="btn-accent flex-1">Confirmar novo horário</button>
    </div>
  `);
}

function exibirConfirmacaoAgendamento(booking, tipo = 'agendamento') {
  const lesson = obterLessonPorId(booking.lessonId);
  abrirDialogo(`
    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-800" aria-hidden="true">✓</div>
    <h2 class="mt-4 text-center text-xl font-bold">${tipo === 'reagendamento' ? 'Reagendamento confirmado!' : 'Aula confirmada!'}</h2>
    <p class="mt-2 text-center text-sm text-muted">${escaparHtml(lesson?.name || 'Aula')} com ${PROFESSORA}</p>
    <div class="mt-4 rounded-xl bg-bg p-4 text-sm">
      <p><strong>Data:</strong> ${formatarDataLonga(booking.date)}</p>
      <p class="mt-1"><strong>Horário:</strong> ${escaparHtml(booking.time)}</p>
      <p class="mt-1"><strong>Valor:</strong> ${formatarPreco(lesson?.price_cents || 0)}</p>
    </div>
    <p class="mt-3 text-xs text-muted">A confirmação foi salva neste navegador. O envio de e-mail não está habilitado no protótipo.</p>
    <button type="button" data-dialog-action="close" class="btn-accent mt-5 w-full">Concluir</button>
  `);
}

bookingDialog.addEventListener('click', (event) => {
  if (event.target === bookingDialog) {
    fecharDialogo();
    return;
  }

  const button = event.target.closest('[data-dialog-action]');
  if (!button) return;
  const action = button.dataset.dialogAction;

  if (action === 'close') {
    fecharDialogo();
    return;
  }

  if (action === 'suggest-slot') {
    const slot = gerarHorariosDisponiveis(obterLessonPorId(state.selectedLessonId))
      .find((item) => item.id === button.dataset.slotId);
    fecharDialogo();
    if (slot) {
      state.selectedSlotId = slot.id;
      state.selectedDate = slot.date;
      resumoSlotSelecionado.textContent = `Horário selecionado: ${formatarDataLonga(slot.date)} às ${slot.time}`;
      resumoSlotSelecionado.classList.remove('hidden');
      renderAluno();
    }
    return;
  }

  if (action === 'confirm-cancel') {
    const bookingId = button.dataset.bookingId;
    const bookings = obterBookings();
    const booking = bookings.find((item) => item.id === bookingId);
    if (!booking || (new Date(`${booking.date}T${booking.time}:00`) - new Date()) / (1000 * 60 * 60) <= 12) {
      fecharDialogo();
      abrirDialogo(`
        <h2 class="text-xl font-bold">Não foi possível cancelar</h2>
        <p class="mt-3 text-sm text-muted">A aula não foi alterada. Ela pode já ter sido cancelada ou o prazo de 12 horas foi encerrado.</p>
        <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Entendi</button>
      `);
      return;
    }

    guardarBookings(bookings.filter((item) => item.id !== bookingId));
    fecharDialogo();
    renderProfessor();
    renderAgendaProfessor();
    renderAluno();
    return;
  }

  if (action === 'confirm-reschedule') {
    const bookingId = state.editingBookingId;
    const bookings = obterBookings();
    const booking = bookings.find((item) => item.id === bookingId);
    const selectedSlotId = bookingDialogContent.querySelector('#novo-horario')?.value;
    const slot = booking && gerarHorariosDisponiveis(obterLessonPorId(booking.lessonId), booking.id)
      .find((item) => item.id === selectedSlotId && item.id !== booking.slotId);
    const aindaPodeReagendar = booking
      && (new Date(`${booking.date}T${booking.time}:00`) - new Date()) / (1000 * 60 * 60) > 12;

    if (!booking || !slot || !aindaPodeReagendar || !dentroDoPrazoMinimo(slot)) {
      fecharDialogo();
      abrirDialogo(`
        <h2 class="text-xl font-bold">Horário indisponível</h2>
        <p class="mt-3 text-sm text-muted">A reserva não foi alterada. O horário escolhido não está mais disponível ou o prazo de 12 horas foi encerrado. Escolha outro horário.</p>
        <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Entendi</button>
      `);
      renderAluno();
      return;
    }

    const atualizado = {
      ...booking,
      slotId: slot.id,
      date: slot.date,
      time: slot.time,
      updated_at: new Date().toISOString(),
    };
    guardarBookings(bookings.map((item) => item.id === bookingId ? atualizado : item));
    fecharDialogo();
    renderProfessor();
    renderAgendaProfessor();
    renderAluno();
    exibirConfirmacaoAgendamento(atualizado, 'reagendamento');
  }
});

bookingDialog.addEventListener('close', () => {
  state.editingBookingId = '';
});

function adicionarAulaProfessor(event) {
  event.preventDefault();
  const formData = new FormData(formAulaProfessor);
  const nome = String(formData.get('nome') || '').trim();
  const duracao = Number(formData.get('duracao'));
  const preco = Number(formData.get('preco'));

  if (!nome || nome.length < 3 || !Number.isInteger(duracao) || duracao < 15 || duracao > 120 || preco <= 0) {
    alert('Informe dados válidos: nome com pelo menos 3 caracteres, duração entre 15 e 120 minutos e preço maior que zero.');
    return;
  }

  const lessons = obterLessons();
  lessons.push({
    id: gerarId('lesson'),
    name: nome,
    duration_minutes: duracao,
    price_cents: Math.round(preco),
    created_at: new Date().toISOString(),
  });
  guardarLessons(lessons);
  formAulaProfessor.reset();
  renderProfessor();
}

function agendarAulaAluno(event) {
  event.preventDefault();
  const nome = document.querySelector('#aluno-nome').value.trim();
  const contato = campoContatoAluno.value.trim();

  erroContatoAluno.textContent = '';
  erroContatoAluno.hidden = true;

  if (!nome || !state.selectedSlotId) {
    abrirDialogo(`
      <h2 class="text-xl font-bold">Dados incompletos</h2>
      <p class="mt-3 text-sm text-muted">Informe seu nome e selecione um horário livre para confirmar a aula.</p>
      <button type="button" data-dialog-action="close" class="btn-primary mt-5 w-full">Entendi</button>
    `);
    return;
  }

  if (!contatoValido(contato)) {
    erroContatoAluno.textContent = 'Informe um e-mail válido ou um telefone com DDD.';
    erroContatoAluno.hidden = false;
    campoContatoAluno.focus();
    return;
  }

  const lesson = obterLessonPorId(state.selectedLessonId);
  const slot = gerarHorariosDisponiveis(lesson).find((item) => item.id === state.selectedSlotId);
  const bookings = obterBookings();
  if (!slot || !dentroDoPrazoMinimo(slot)) {
    state.selectedSlotId = '';
    resumoSlotSelecionado.classList.add('hidden');
    renderAluno();
    mostrarConflitoAgendamento();
    return;
  }

  const novoAgendamento = {
    id: gerarId('booking'),
    lessonId: slot.lessonId,
    slotId: slot.id,
    studentName: nome,
    contact: contato,
    duration_minutes: lesson.duration_minutes,
    date: slot.date,
    time: slot.time,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  };
  bookings.push(novoAgendamento);

  guardarBookings(bookings);
  salvarStorage(STORAGE_KEYS.activeStudentContact, contato);
  state.selectedSlotId = '';
  resumoSlotSelecionado.classList.add('hidden');
  renderProfessor();
  renderAgendaProfessor();
  renderAluno();
  exibirConfirmacaoAgendamento(novoAgendamento);
}

function mostrarConflitoAgendamento() {
  const slots = gerarHorariosDisponiveis(obterLessonPorId(state.selectedLessonId)).slice(0, 3);

  abrirDialogo(`
    <h2 class="text-xl font-bold">Esse horário acabou de ser ocupado</h2>
    <p class="mt-2 text-sm text-muted">Seu agendamento não foi confirmado. Escolha uma destas próximas opções:</p>
    <div class="mt-4 space-y-2">
      ${slots.length ? slots.map((slot) => `
        <button type="button" data-dialog-action="suggest-slot" data-slot-id="${escaparHtml(slot.id)}" class="w-full rounded-xl border border-border p-3 text-left text-sm hover:border-accent">
          ${formatarDataLonga(slot.date)} às ${escaparHtml(slot.time)}
        </button>
      `).join('') : '<p class="text-sm text-muted">Não há outros horários livres para este tipo de aula.</p>'}
    </div>
    <button type="button" data-dialog-action="close" class="btn-ghost mt-4 w-full">Fechar</button>
  `);
}

document.querySelectorAll('.role-button').forEach((button) => {
  button.addEventListener('click', () => navegarPara(button.dataset.role));
});

document.querySelector('#logout-professor').addEventListener('click', () => navegarPara('login'));
document.querySelector('#logout-aluno').addEventListener('click', () => navegarPara('login'));
document.querySelector('#abrir-agenda-professor').addEventListener('click', () => navegarPara('agenda'));
document.querySelector('#abrir-disponibilidade-card').addEventListener('click', () => navegarPara('availability'));
document.querySelector('#voltar-professor').addEventListener('click', () => navegarPara('professor'));
document.querySelector('#voltar-painel-agenda').addEventListener('click', () => navegarPara('professor'));
formAulaProfessor.addEventListener('submit', adicionarAulaProfessor);
formDisponibilidade.addEventListener('submit', adicionarDisponibilidade);
formAgendaAluno.addEventListener('submit', agendarAulaAluno);
campoContatoAluno.addEventListener('input', () => {
  erroContatoAluno.hidden = true;
  salvarStorage(STORAGE_KEYS.activeStudentContact, campoContatoAluno.value.trim());
  renderMinhasAulas();
});

listaTiposAula.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-lesson-id]');
  if (!button || button.dataset.lessonId === state.selectedLessonId) return;

  state.selectedLessonId = button.dataset.lessonId;
  state.selectedSlotId = '';
  resumoSlotSelecionado.classList.add('hidden');
  renderAluno();
});

if (!localStorage.getItem(STORAGE_KEYS.lessons) && !localStorage.getItem(STORAGE_KEYS.bookings) && !localStorage.getItem(STORAGE_KEYS.availability)) {
  criarDadosBase();
}

const bookingsExistentes = obterBookings();
if (bookingsExistentes.some((booking) => booking.id === 'booking-1' && booking.contact === 'ana@email.com')) {
  guardarBookings(bookingsExistentes.filter((booking) => booking.id !== 'booking-1'));
}

window.addEventListener('storage', (event) => {
  if ([STORAGE_KEYS.lessons, STORAGE_KEYS.bookings, STORAGE_KEYS.availability].includes(event.key)) {
    if (state.view === 'professor') renderProfessor();
    if (state.view === 'availability') renderDisponibilidade();
    if (state.view === 'agenda') renderAgendaProfessor();
    if (state.view === 'aluno') renderAluno();
  }
});

navegarPara('login');
