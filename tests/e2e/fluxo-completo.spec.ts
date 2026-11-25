import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('E2E requer as variáveis públicas do Supabase de testes.');
}

const RUN = Date.now().toString(36);
const PASSWORD = `Flow#${RUN}-Test`;
const teacher = {
  nome: 'Professora E2E',
  email: `e2e.prof.${RUN}@example.com`,
  telefone: '41999990001',
  slug: `e2e-prof-${RUN}`,
};
const studentOne = {
  nome: 'Aluno E2E Um',
  email: `e2e.aluno1.${RUN}@example.com`,
  telefone: '11999990002',
};
const studentTwo = {
  nome: 'Aluno E2E Dois',
  email: `e2e.aluno2.${RUN}@example.com`,
  telefone: '31999990003',
};
const attemptedAccounts = new Set<string>();
const lessonOne = { nome: 'Conversação individual', duracao: '50', cents: '4900' };
const lessonTwo = { nome: 'Speaking for travel', duracao: '30', cents: '3900' };
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function saoPauloDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function localDateOffset(offset: number) {
  const date = new Date(`${saoPauloDate(new Date())}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + offset);
  return saoPauloDate(date);
}

function localWeekday(date: string) {
  return new Date(`${date}T12:00:00-03:00`).getUTCDay();
}

const DATE_ONE = localDateOffset(1);
const DATE_TWO = localDateOffset(2);
const testId = (page: Page, id: string) => page.getByTestId(id);
const slotLocator = (page: Page, date: string, time?: string) => page.locator(
  `[data-testid="slot"][data-date="${date}"]${time ? `[data-time="${time}"]` : ''}`,
);

function createAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function withAccount<T>(
  account: { email: string; },
  action: (client: ReturnType<typeof createAnonClient>, userId: string) => Promise<T>,
) {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: PASSWORD });
  if (error || !data.user) {
    throw new Error(`E2E não conseguiu autenticar a conta de teste (${error?.code || 'sem usuário'}).`);
  }

  try {
    return await action(client, data.user.id);
  } finally {
    const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
    if (signOutError) throw new Error(`E2E não conseguiu encerrar a sessão de teste (${signOutError.code || 'erro'}).`);
  }
}

async function removeAccount(account: { email: string }, role: 'professora' | 'aluno') {
  const client = createAnonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email: account.email,
    password: PASSWORD,
  });
  if (signInError) {
    if (
      signInError.status === 400
      && ['invalid_credentials', 'user_not_found'].includes(signInError.code || '')
    ) return;
    throw new Error(`E2E não conseguiu autenticar uma conta para limpeza (${signInError.code || 'erro'}).`);
  }

  const functionName = role === 'professora'
    ? 'excluir_minha_conta_professora'
    : 'excluir_minha_conta_aluno';
  const { error: deleteError } = await client.rpc(functionName);
  if (deleteError) {
    throw new Error(`E2E falhou ao excluir uma conta temporária (${deleteError.code || 'erro'}).`);
  }
  const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
  if (signOutError) throw new Error(`E2E não conseguiu encerrar a sessão após a limpeza (${signOutError.code || 'erro'}).`);
  const { error: verificationError } = await client.auth.signInWithPassword({
    email: account.email,
    password: PASSWORD,
  });
  if (
    !verificationError
    || verificationError.status !== 400
    || !['invalid_credentials', 'user_not_found'].includes(verificationError.code || '')
  ) {
    throw new Error('E2E não confirmou a exclusão da conta temporária.');
  }
}

async function newContext(browser: Browser) {
  const projectUse = test.info().project.use;
  return browser.newContext({
    baseURL: typeof projectUse.baseURL === 'string' ? projectUse.baseURL : undefined,
    viewport: projectUse.viewport,
    isMobile: projectUse.isMobile,
    hasTouch: projectUse.hasTouch,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
}

async function createAccount(
  page: Page,
  role: 'professora' | 'aluno',
  account: { nome: string; email: string; telefone: string; slug?: string },
  landing: 'teacher' | 'public' | 'student',
) {
  await testId(page, 'auth-tab-criar').click();
  await testId(page, `role-${role}`).click();
  await testId(page, 'field-nome').fill(account.nome);
  await testId(page, 'field-email').fill(account.email);
  await testId(page, 'field-telefone').fill(account.telefone);
  await testId(page, 'field-senha').fill(PASSWORD);
  if (role === 'professora') {
    if (!account.slug) throw new Error('A conta de professora E2E precisa de um slug.');
    await testId(page, 'field-slug').fill(account.slug);
    await expect(page.getByText('Link disponível.')).toBeVisible();
  } else {
    await page.getByLabel(/Aceito o uso dos meus dados para identificar minha conta/).check();
  }

  attemptedAccounts.add(account.email);
  await testId(page, 'auth-submit').click();
  const landingTestId = landing === 'teacher'
    ? 'painel-professora'
    : landing === 'public'
      ? 'catalogo-aula'
      : 'nav-perfil';
  await expect(testId(page, landingTestId).first()).toBeVisible();
}

async function addLesson(page: Page, lesson: { nome: string; duracao: string; cents: string }) {
  await testId(page, 'aula-novo').click();
  await testId(page, 'aula-nome').fill(lesson.nome);
  await testId(page, 'aula-duracao').fill(lesson.duracao);
  await testId(page, 'aula-preco').fill(lesson.cents);
  const formattedPrice = lesson.cents === '4900' ? /R\$\s*49,00/ : /R\$\s*39,00/;
  await expect(testId(page, 'aula-preco')).toHaveValue(formattedPrice);
  await testId(page, 'aula-salvar').click();
  await expect(testId(page, 'aula-item').filter({ hasText: lesson.nome })).toBeVisible();
}

async function addAvailability(page: Page, date: string, start: string, end: string) {
  await testId(page, 'disp-dia').selectOption({ label: WEEKDAYS[localWeekday(date)] });
  await testId(page, 'disp-inicio').fill(start);
  await testId(page, 'disp-fim').fill(end);
  await testId(page, 'disp-adicionar').click();
}

async function setCancellationLeadTime(page: Page, hours: string) {
  await testId(page, 'nav-perfil').click();
  await testId(page, 'perfil-antecedencia').fill(hours);
  await testId(page, 'perfil-salvar').click();
  await expect(testId(page, 'toast-sucesso')).toBeVisible();
  await testId(page, 'nav-painel').click();
}

async function reloadStudentDashboard(page: Page) {
  const profileInitialization = page.waitForResponse((response) =>
    response.url().includes('/rest/v1/rpc/garantir_perfil') && response.ok(),
  );
  await page.reload();
  await profileInitialization;
  await testId(page, 'nav-minhas-aulas').click();
  await expect(page.getByRole('heading', { name: 'Minhas aulas' })).toBeVisible();
}

async function verifyTeacherLessons(expectedCount: number) {
  await withAccount(teacher, async (client, userId) => {
    const { data, error } = await client.from('aulas')
      .select('nome,duracao_min,preco')
      .eq('professora_id', userId)
      .order('nome');
    if (error) throw new Error(`E2E falhou ao consultar aulas (${error.code}).`);
    expect(data).toHaveLength(expectedCount);
    if (expectedCount === 2) {
      expect(data?.map((row) => [row.nome, row.duracao_min, Number(row.preco)]))
        .toEqual(expect.arrayContaining([
          [lessonOne.nome, 50, 49],
          [lessonTwo.nome, 30, 39],
        ]));
    }
  });
}

test.describe('Fluxo ponta a ponta: professora configura, aluno reserva', () => {
  test.describe.configure({ mode: 'serial' });

  let teacherContext: BrowserContext;
  let studentOneContext: BrowserContext;
  let studentTwoContext: BrowserContext;
  let teacherPage: Page;
  let studentOnePage: Page;
  let studentTwoPage: Page;
  let lessonOneId = '';
  let reservedTime = '';
  let bookingId = '';

  test.beforeAll(async ({ browser }) => {
    [teacherContext, studentOneContext, studentTwoContext] = await Promise.all([
      newContext(browser),
      newContext(browser),
      newContext(browser),
    ]);
    [teacherPage, studentOnePage, studentTwoPage] = await Promise.all([
      teacherContext.newPage(),
      studentOneContext.newPage(),
      studentTwoContext.newPage(),
    ]);
  });

  test.afterAll(async () => {
    const cleanupFailures: string[] = [];
    for (const [account, role] of [
      [studentOne, 'aluno'],
      [studentTwo, 'aluno'],
      [teacher, 'professora'],
    ] as const) {
      if (!attemptedAccounts.has(account.email)) continue;
      try {
        await removeAccount(account, role);
      } catch {
        cleanupFailures.push(role);
      }
    }

    await Promise.all([
      teacherContext?.close(),
      studentOneContext?.close(),
      studentTwoContext?.close(),
    ]);
    if (cleanupFailures.length) {
      throw new Error(`E2E não removeu ${cleanupFailures.length} conta(s) temporária(s): ${cleanupFailures.join(', ')}.`);
    }
  });

  test('E2E-01 professora cria conta e vê o painel', async () => {
    await teacherPage.goto('/');
    await testId(teacherPage, 'home-professora').click();
    await createAccount(teacherPage, 'professora', teacher, 'teacher');

    await withAccount(teacher, async (client, userId) => {
      const { data, error } = await client.from('perfis')
        .select('id,slug')
        .eq('id', userId)
        .single();
      if (error) throw new Error(`E2E falhou ao consultar perfil de professora (${error.code}).`);
      expect(data.id).toBe(userId);
      expect(data.slug).toBe(teacher.slug);
    });
  });

  test('E2E-02 professora cadastra duas aulas e os preços são persistidos', async () => {
    await addLesson(teacherPage, lessonOne);
    await addLesson(teacherPage, lessonTwo);
    await expect(testId(teacherPage, 'aula-item')).toHaveCount(2);
    await verifyTeacherLessons(2);
  });

  test('E2E-03 nome de aula com dois caracteres é bloqueado sem gravar', async () => {
    await testId(teacherPage, 'aula-novo').click();
    await testId(teacherPage, 'aula-nome').fill('En');
    await testId(teacherPage, 'aula-duracao').fill('50');
    await testId(teacherPage, 'aula-preco').fill('4900');
    await testId(teacherPage, 'aula-salvar').click();
    await expect(testId(teacherPage, 'erro-nome')).toBeVisible();
    await testId(teacherPage, 'aula-cancelar').click();
    await expect(testId(teacherPage, 'aula-item')).toHaveCount(2);
    await verifyTeacherLessons(2);
  });

  test('E2E-04 professora define antecedência de 72 horas', async () => {
    await setCancellationLeadTime(teacherPage, '72');
    await withAccount(teacher, async (client, userId) => {
      const { data, error } = await client.from('perfis')
        .select('antecedencia_cancelamento_horas')
        .eq('id', userId)
        .single();
      if (error) throw new Error(`E2E falhou ao consultar a antecedência (${error.code}).`);
      expect(data.antecedencia_cancelamento_horas).toBe(72);
    });
  });

  test('E2E-05 disponibilidade recorrente, sobreposição e bloqueio são persistidos', async () => {
    await setCancellationLeadTime(teacherPage, '0');
    await testId(teacherPage, 'nav-disponibilidade').click();
    await addAvailability(teacherPage, DATE_ONE, '09:00', '12:00');
    await addAvailability(teacherPage, DATE_TWO, '09:00', '12:00');
    await addAvailability(teacherPage, DATE_ONE, '10:00', '11:00');
    await expect(testId(teacherPage, 'erro-disponibilidade')).toBeVisible();
    await testId(teacherPage, 'bloq-data').fill(DATE_TWO);
    await testId(teacherPage, 'bloq-adicionar').click();
    await expect(testId(teacherPage, 'bloq-item')).toHaveCount(1);

    await withAccount(teacher, async (client, userId) => {
      const { data: availability, error: availabilityError } = await client.from('disponibilidades')
        .select('dia_semana,hora_inicio,hora_fim')
        .eq('professora_id', userId);
      if (availabilityError) throw new Error(`E2E falhou ao consultar disponibilidades (${availabilityError.code}).`);
      expect(availability).toHaveLength(2);
      expect(availability?.map((row) => row.dia_semana).sort((a, b) => a - b))
        .toEqual([localWeekday(DATE_ONE), localWeekday(DATE_TWO)].sort((a, b) => a - b));
      const { data: blocks, error: blocksError } = await client.from('bloqueios')
        .select('data')
        .eq('professora_id', userId);
      if (blocksError) throw new Error(`E2E falhou ao consultar bloqueios (${blocksError.code}).`);
      expect(blocks).toEqual([{ data: DATE_TWO }]);
    });

    await testId(teacherPage, 'nav-painel').click();
  });

  test('E2E-06 aluno anônimo vê horários livres e nenhum no dia bloqueado', async () => {
    const anonClient = createAnonClient();
    const { data: publicRules, error: rulesError } = await anonClient.from('regras_agendamento_publicas')
      .select('antecedencia_cancelamento_horas')
      .eq('slug', teacher.slug)
      .single();
    if (rulesError) throw new Error(`E2E falhou ao consultar as regras públicas (${rulesError.code}).`);
    expect(publicRules.antecedencia_cancelamento_horas).toBe(0);
    const { data: publicLessons, error } = await anonClient.from('aulas_publicas')
      .select('aula_id')
      .eq('slug', teacher.slug)
      .eq('nome', lessonOne.nome)
      .single();
    if (error) throw new Error(`E2E falhou ao consultar a aula pública (${error.code}).`);
    lessonOneId = publicLessons.aula_id;
    const { data: availableSlots, error: availableSlotError } = await anonClient.rpc('listar_horarios_livres', {
      slug: teacher.slug,
      aula_id: lessonOneId,
      data: DATE_ONE,
    });
    if (availableSlotError) throw new Error(`E2E falhou ao consultar horários livres (${availableSlotError.code}).`);
    expect(availableSlots?.length, `Nenhum horário retornado para ${DATE_ONE} (dia ${localWeekday(DATE_ONE)}).`)
      .toBeGreaterThan(0);
    const futureSlots = availableSlots?.filter((slot) => new Date(slot.inicio).getTime() >= Date.now()) || [];
    expect(
      futureSlots.length,
      `Horários retornados pelo Supabase (${availableSlots?.map((slot) => slot.inicio).join(', ')}) anteriores ao relógio do teste (${new Date().toISOString()}).`,
    ).toBeGreaterThan(0);
    const { data: blockedSlots, error: blockedSlotError } = await anonClient.rpc('listar_horarios_livres', {
      slug: teacher.slug,
      aula_id: lessonOneId,
      data: DATE_TWO,
    });
    if (blockedSlotError) throw new Error(`E2E falhou ao consultar horários bloqueados (${blockedSlotError.code}).`);
    expect(blockedSlots).toHaveLength(0);

    await studentOnePage.goto(`/?professora=${teacher.slug}`);
    const lessonButton = testId(studentOnePage, 'catalogo-aula').filter({ hasText: lessonOne.nome });
    await lessonButton.click();
    await expect(lessonButton).toHaveAttribute('aria-pressed', 'true');
    await expect(slotLocator(studentOnePage, DATE_ONE).first()).toBeVisible();
    const times = await slotLocator(studentOnePage, DATE_ONE).evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-time') || ''),
    );
    expect(times.length).toBeGreaterThan(0);
    expect(times.every((time) => time >= '09:00' && time <= '11:00')).toBe(true);
    await expect(slotLocator(studentOnePage, DATE_TWO)).toHaveCount(0);
  });

  test('E2E-07 aluno cria conta, mantém a seleção e reserva com consentimento', async () => {
    const firstSlot = slotLocator(studentOnePage, DATE_ONE).first();
    reservedTime = (await firstSlot.getAttribute('data-time')) || '';
    expect(reservedTime).toMatch(/^\d{2}:\d{2}$/);
    await firstSlot.click();
    await testId(studentOnePage, 'continuar-login').click();
    await createAccount(studentOnePage, 'aluno', studentOne, 'public');
    const selectedSlot = slotLocator(studentOnePage, DATE_ONE, reservedTime);
    await expect(selectedSlot).toHaveAttribute('aria-pressed', 'true');
    await testId(studentOnePage, 'consentimento').check();
    await testId(studentOnePage, 'confirmar-reserva').click();
    const confirmation = testId(studentOnePage, 'reserva-confirmada');
    await expect(confirmation).toContainText(lessonOne.nome);
    await expect(confirmation).toContainText(/49,00/);
    await expect(confirmation).toContainText(reservedTime);

    await withAccount(studentOne, async (client, userId) => {
      const { data: profile, error: profileError } = await client.from('perfis_alunos')
        .select('consentimento_versao')
        .eq('id', userId)
        .single();
      if (profileError) throw new Error(`E2E falhou ao consultar perfil de aluno (${profileError.code}).`);
      expect(profile.consentimento_versao).toBe('agendamento-v1');

      const { data: bookings, error: bookingsError } = await client.rpc('listar_meus_agendamentos');
      if (bookingsError) throw new Error(`E2E falhou ao consultar reservas do aluno (${bookingsError.code}).`);
      expect(bookings).toHaveLength(1);
      expect(bookings[0].status).toBe('confirmado');
      bookingId = bookings[0].id;
      const { data: storedBooking, error: storedBookingError } = await client.from('agendamentos')
        .select('status,consentimento_versao,consentimento_lgpd_em')
        .eq('id', bookingId)
        .single();
      if (storedBookingError) throw new Error(`E2E falhou ao consultar consentimento da reserva (${storedBookingError.code}).`);
      expect(storedBooking.status).toBe('confirmado');
      expect(storedBooking.consentimento_versao).toBe('agendamento-v1');
      expect(storedBooking.consentimento_lgpd_em).toBeTruthy();
    });

    await withAccount(teacher, async (client, userId) => {
      const { data: booking, error: bookingError } = await client.from('agendamentos')
        .select('id,aluno_id,aluno_nome,status')
        .eq('professora_id', userId)
        .eq('id', bookingId)
        .single();
      if (bookingError) throw new Error(`E2E falhou ao consultar a reserva da professora (${bookingError.code}).`);
      expect(booking.aluno_id).toBeTruthy();
      expect(booking.aluno_nome).toBe(studentOne.nome);
      expect(booking.status).toBe('confirmado');

      const { data: notifications, error: notificationsError } = await client.from('notificacoes')
        .select('tipo')
        .eq('agendamento_id', bookingId);
      if (notificationsError) throw new Error(`E2E falhou ao consultar notificações (${notificationsError.code}).`);
      expect(notifications).toHaveLength(2);
      expect(notifications?.map((notification) => notification.tipo).sort())
        .toEqual(['confirmacao', 'lembrete_24h']);
    });
  });

  test('E2E-08 horário reservado não aparece para outro aluno anônimo', async () => {
    await studentTwoPage.goto(`/?professora=${teacher.slug}`);
    await testId(studentTwoPage, 'catalogo-aula').filter({ hasText: lessonOne.nome }).click();
    await expect(slotLocator(studentTwoPage, DATE_ONE).first()).toBeVisible();
    await expect(slotLocator(studentTwoPage, DATE_ONE, reservedTime)).toHaveCount(0);
  });

  test('E2E-09 aluno vê sua reserva confirmada em Minhas aulas', async () => {
    await testId(studentOnePage, 'nav-minhas-aulas').click();
    const booking = testId(studentOnePage, 'reserva-item');
    await expect(booking).toHaveCount(1);
    await expect(booking).toContainText(/confirmado/i);
  });

  test('E2E-10 professora vê o aluno na agenda e a reserva confirmada', async () => {
    await teacherPage.reload();
    await testId(teacherPage, 'nav-agenda').click();
    await testId(teacherPage, 'agenda-data').fill(DATE_ONE);
    const booking = testId(teacherPage, 'agenda-item').filter({ hasText: studentOne.nome });
    await expect(booking).toBeVisible();
    await expect(booking).toContainText(/confirmado/i);
    await expect(booking.getByTestId('agenda-confirmar')).toHaveCount(0);
    await testId(teacherPage, 'nav-painel').click();
    await setCancellationLeadTime(teacherPage, '72');
  });

  test('E2E-11 prazo de 72 horas bloqueia o cancelamento e informa o aluno', async () => {
    await withAccount(studentOne, async (client) => {
      const { data, error } = await client.rpc('listar_meus_agendamentos');
      if (error) throw new Error(`E2E falhou ao confirmar que a reserva continua ativa (${error.code}).`);
      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('confirmado');
    });
    await reloadStudentDashboard(studentOnePage);
    const booking = testId(studentOnePage, 'reserva-item');
    await expect(booking).toHaveCount(1);
    await expect(booking.getByTestId('msg-fora-prazo')).toBeVisible();
    await expect(booking.getByTestId('btn-cancelar')).toHaveCount(0);
  });

  test('E2E-12 antecedência zero permite cancelar e libera o horário', async () => {
    await setCancellationLeadTime(teacherPage, '0');
    await withAccount(teacher, async (client, userId) => {
      const { data, error } = await client.from('perfis')
        .select('antecedencia_cancelamento_horas')
        .eq('id', userId)
        .single();
      if (error) throw new Error(`E2E falhou ao confirmar antecedência zero (${error.code}).`);
      expect(data.antecedencia_cancelamento_horas).toBe(0);
    });
    await reloadStudentDashboard(studentOnePage);
    const booking = testId(studentOnePage, 'reserva-item');
    await expect(booking).toHaveCount(1);
    await expect(booking.getByTestId('btn-cancelar')).toBeVisible();
    studentOnePage.once('dialog', (dialog) => dialog.accept());
    await booking.getByTestId('btn-cancelar').click();
    await expect(booking).toContainText(/cancelado/i);
    await withAccount(studentOne, async (client) => {
      const { data, error } = await client.rpc('listar_meus_agendamentos');
      if (error) throw new Error(`E2E falhou ao consultar a reserva cancelada (${error.code}).`);
      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('cancelado');
    });
    await withAccount(teacher, async (client) => {
      const { data, error } = await client.from('notificacoes')
        .select('id')
        .eq('agendamento_id', bookingId)
        .eq('tipo', 'cancelamento');
      if (error) throw new Error(`E2E falhou ao consultar notificação de cancelamento (${error.code}).`);
      expect(data).toHaveLength(1);
    });

    await studentTwoPage.goto(`/?professora=${teacher.slug}`);
    await testId(studentTwoPage, 'catalogo-aula').filter({ hasText: lessonOne.nome }).click();
    await expect(slotLocator(studentTwoPage, DATE_ONE, reservedTime)).toHaveCount(1);
  });

  test('E2E-13 segundo aluno não vê a reserva alheia e sua conta pode ser excluída', async () => {
    await studentTwoPage.goto('/');
    await testId(studentTwoPage, 'home-aluno').click();
    await createAccount(studentTwoPage, 'aluno', studentTwo, 'student');
    await expect(testId(studentTwoPage, 'reserva-item')).toHaveCount(0);
    await withAccount(studentTwo, async (client) => {
      const { data, error } = await client.rpc('listar_meus_agendamentos');
      if (error) throw new Error(`E2E falhou ao verificar o isolamento do aluno (${error.code}).`);
      expect(data).toHaveLength(0);
    });

    await testId(studentTwoPage, 'nav-perfil').click();
    studentTwoPage.once('dialog', (dialog) => dialog.accept());
    await testId(studentTwoPage, 'perfil-excluir').click();
    await expect(testId(studentTwoPage, 'home-professora')).toBeVisible();
    const client = createAnonClient();
    const { error } = await client.auth.signInWithPassword({
      email: studentTwo.email,
      password: PASSWORD,
    });
    expect(error).not.toBeNull();
  });
});
