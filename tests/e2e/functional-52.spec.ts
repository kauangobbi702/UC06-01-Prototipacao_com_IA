import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { addLocalDays, formatLocalDate, getWeekday, todayInSaoPaulo } from '../../src/lib/dates.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Testes funcionais requerem as variáveis públicas do Supabase de testes.');
}

const RUN = Date.now().toString(36);
const PASSWORD = `Functional#${RUN}-Test`;
const teacher = {
  nome: 'Professora Funcional',
  email: `func.prof.${RUN}@example.com`,
  telefone: '41999990001',
  slug: `func-prof-${RUN}`,
};
const teacherTwo = {
  nome: 'Professora Funcional Dois',
  email: `func.prof2.${RUN}@example.com`,
  telefone: '41999990002',
  slug: `func-prof2-${RUN}`,
};
const student = {
  nome: 'Aluno Funcional',
  email: `func.aluno.${RUN}@example.com`,
  telefone: '',
};
const studentTwo = {
  nome: 'Aluna Funcional Dois',
  email: `func.aluna2.${RUN}@example.com`,
  telefone: '11999990003',
};
const lesson = { nome: 'Conversação individual', duration: '50', cents: '4900' };
const lessonTwo = { nome: 'Speaking for travel', duration: '30', cents: '3900' };
const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const dateOne = addLocalDays(todayInSaoPaulo(), 1);
const dateTwo = addLocalDays(todayInSaoPaulo(), 2);
const dateThree = addLocalDays(todayInSaoPaulo(), 3);
const dateFour = addLocalDays(todayInSaoPaulo(), 4);
const id = (page: Page, testId: string) => page.getByTestId(testId);
const slot = (page: Page, date: string, time?: string) => page.locator(
  `[data-testid="slot"][data-date="${date}"]${time ? `[data-time="${time}"]` : ''}`,
);

function anonClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function withAccount<T>(
  account: { email: string },
  action: (client: ReturnType<typeof anonClient>, userId: string) => Promise<T>,
) {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: PASSWORD });
  if (error || !data.user) throw new Error(`Não foi possível autenticar a conta de teste (${error?.code || 'sem usuário'}).`);
  try {
    return await action(client, data.user.id);
  } finally {
    const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
    if (signOutError) throw new Error(`Não foi possível encerrar a sessão de teste (${signOutError.code}).`);
  }
}

async function newContext(browser: Browser) {
  const baseURL = test.info().project.use.baseURL;
  return browser.newContext({
    baseURL: typeof baseURL === 'string' ? baseURL : undefined,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
}

function offsetWeekday(date: string) {
  return new Date(`${date}T12:00:00-03:00`).getUTCDay();
}

function dateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

async function chooseDate(page: Page, date: string) {
  const label = formatLocalDate(date, { day: 'numeric', month: 'short' });
  await page.getByRole('button', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).click();
}

async function openPublicLesson(page: Page, slug: string, lessonName: string) {
  await page.goto(`/?professora=${slug}`);
  const lessonButton = id(page, 'catalogo-aula').filter({ hasText: lessonName });
  await expect(lessonButton).toBeVisible();
  await lessonButton.click();
  await expect(id(page, 'slot').first()).toBeVisible();
}

async function addLesson(page: Page, data: { nome: string; duration: string; cents: string }) {
  await id(page, 'aula-novo').click();
  await id(page, 'aula-nome').fill(data.nome);
  await id(page, 'aula-duracao').fill(data.duration);
  await id(page, 'aula-preco').fill(data.cents);
  await id(page, 'aula-salvar').click();
  await expect(id(page, 'aula-item').filter({ hasText: data.nome })).toBeVisible();
}

async function addAvailability(page: Page, date: string, start = '09:00', end = '12:00') {
  await id(page, 'disp-dia').selectOption({ label: weekdays[offsetWeekday(date)] });
  await id(page, 'disp-inicio').fill(start);
  await id(page, 'disp-fim').fill(end);
  await id(page, 'disp-adicionar').click();
}

async function createTeacher(page: Page, account: typeof teacher, attempted: Map<string, 'professora' | 'aluno'>) {
  attempted.set(account.email, 'professora');
  await page.goto('/');
  await id(page, 'home-professora').click();
  await id(page, 'auth-tab-criar').click();
  await id(page, 'role-professora').click();
  await id(page, 'field-nome').fill(account.nome);
  await id(page, 'field-email').fill(account.email);
  await id(page, 'field-telefone').fill(account.telefone);
  await id(page, 'field-senha').fill(PASSWORD);
  await id(page, 'field-slug').fill(account.slug);
  await expect(page.getByText('Link disponível.')).toBeVisible();
  await id(page, 'auth-submit').click();
  await expect(id(page, 'painel-professora')).toBeVisible();
}

async function createStudent(
  page: Page,
  account: typeof student,
  attempted: Map<string, 'professora' | 'aluno'>,
  fromPublic = false,
) {
  attempted.set(account.email, 'aluno');
  if (!fromPublic) {
    await page.goto('/');
    await id(page, 'home-aluno').click();
  }
  await id(page, 'auth-tab-criar').click();
  await id(page, 'role-aluno').click();
  await id(page, 'field-nome').fill(account.nome);
  await id(page, 'field-email').fill(account.email);
  await id(page, 'field-telefone').fill(account.telefone);
  await id(page, 'field-senha').fill(PASSWORD);
  await page.getByLabel(/Aceito o uso dos meus dados para identificar minha conta/).check();
  await id(page, 'auth-submit').click();
  await expect(fromPublic ? id(page, 'catalogo-aula').first() : id(page, 'nav-perfil')).toBeVisible();
}

async function getLessonId(slug: string, lessonName: string) {
  const client = anonClient();
  const { data, error } = await client.from('aulas_publicas')
    .select('aula_id')
    .eq('slug', slug)
    .eq('nome', lessonName)
    .single();
  if (error || !data) throw new Error(`Não foi possível consultar a aula pública (${error?.code || 'sem registro'}).`);
  return data.aula_id as string;
}

async function availableSlots(slug: string, lessonId: string, date: string) {
  const { data, error } = await anonClient().rpc('listar_horarios_livres', {
    slug,
    aula_id: lessonId,
    data: date,
  });
  if (error) throw new Error(`Não foi possível consultar horários (${error.code}).`);
  return data || [];
}

async function saveLeadTime(page: Page, hours: string) {
  await id(page, 'nav-perfil').click();
  await id(page, 'perfil-antecedencia').fill(hours);
  await id(page, 'perfil-salvar').click();
  if (hours !== '-1' && hours !== '73' && hours !== '1.5' && hours !== '') {
    await expect(id(page, 'toast-sucesso')).toBeVisible();
  }
  await id(page, 'nav-painel').click();
}

async function signInUI(page: Page, account: { email: string }, role: 'professora' | 'aluno', password = PASSWORD) {
  await page.goto('/');
  if (role === 'professora') {
    await page.getByRole('button', { name: 'Acesso do(a) Professor(a)' }).click();
  } else {
    await page.getByRole('button', { name: 'Entrar como Aluno(a)' }).click();
  }
  await id(page, 'field-email').fill(account.email);
  await id(page, 'field-senha').fill(password);
  await id(page, 'auth-submit').click();
}

async function openStudentDashboard(page: Page) {
  await page.goto('/');
  await expect(id(page, 'nav-perfil')).toBeVisible();
}

async function removeAccount(account: { email: string }, role: 'professora' | 'aluno') {
  const client = anonClient();
  const { error: loginError } = await client.auth.signInWithPassword({ email: account.email, password: PASSWORD });
  if (loginError) {
    if (loginError.status === 400 && ['invalid_credentials', 'user_not_found'].includes(loginError.code || '')) return;
    throw new Error(`Falha ao autenticar conta para limpeza (${loginError.code || 'erro'}).`);
  }
  const rpc = role === 'professora' ? 'excluir_minha_conta_professora' : 'excluir_minha_conta_aluno';
  const { error } = await client.rpc(rpc);
  if (error) throw new Error(`Falha ao excluir conta temporária (${error.code}).`);
  await client.auth.signOut({ scope: 'local' });
  const { error: verificationError } = await client.auth.signInWithPassword({ email: account.email, password: PASSWORD });
  if (
    !verificationError
    || verificationError.status !== 400
    || !['invalid_credentials', 'user_not_found'].includes(verificationError.code || '')
  ) {
    throw new Error('A exclusão da conta temporária não foi confirmada.');
  }
}

test('TF-01 a TF-52: rodada funcional do EnglishFlow', async ({ browser }) => {
  test.setTimeout(30 * 60 * 1000);
  const contexts: BrowserContext[] = [];
  const attempted = new Map<string, 'professora' | 'aluno'>();
  const outcomes: Array<{ id: string; status: 'Aprovado' | 'Reprovado' | 'Parcial' | 'N/A'; detail?: string }> = [];
  const runCase = async (caseId: string, action: () => Promise<void>, status: 'Aprovado' | 'Parcial' = 'Aprovado') => {
    try {
      await test.step(caseId, action);
      outcomes.push({ id: caseId, status });
    } catch (error) {
      const detail = error instanceof Error
        ? `${error.message.split('\n')[0]}${error.stack ? ` (${error.stack.split('\n').slice(1, 3).join(' ').trim()})` : ''}`
        : String(error);
      outcomes.push({ id: caseId, status: 'Reprovado', detail });
      console.error(`${caseId} REPROVADO: ${detail}`);
      if (['TF-06', 'TF-07', 'TF-08', 'TF-09', 'TF-10', 'TF-11', 'TF-12', 'TF-13', 'TF-14', 'TF-15', 'TF-16', 'TF-17', 'TF-19'].includes(caseId)) {
        await teacherPage.goto('/');
        await expect(id(teacherPage, 'painel-professora')).toBeVisible({ timeout: 5000 }).catch(() => undefined);
      }
    }
  };
  const teacherContext = await newContext(browser);
  const studentContext = await newContext(browser);
  const studentTwoContext = await newContext(browser);
  const anonymousContext = await newContext(browser);
  const teacherTwoContext = await newContext(browser);
  contexts.push(teacherContext, studentContext, studentTwoContext, anonymousContext, teacherTwoContext);
  for (const context of contexts) {
    context.setDefaultTimeout(10_000);
    context.setDefaultNavigationTimeout(20_000);
  }
  const teacherPage = await teacherContext.newPage();
  const studentPage = await studentContext.newPage();
  const studentTwoPage = await studentTwoContext.newPage();
  const anonymousPage = await anonymousContext.newPage();
  const teacherTwoPage = await teacherTwoContext.newPage();
  const lessonIdRef = { value: '' };
  const studentIdRef = { value: '' };
  const bookingOneRef = { value: '' };
  const bookingTwoRef = { value: '' };
  const studentTwoBookingRef = { value: '' };
  let firstTime = '09:00';
  let studentTwoTime = '10:00';
  let raceTime = '11:00';

  try {
    await runCase('TF-32', async () => {
      await createTeacher(teacherPage, teacher, attempted);
      await withAccount(teacher, async (client, userId) => {
        const { data, error } = await client.from('perfis').select('id,slug').eq('id', userId).single();
        if (error) throw error;
        expect(data.id).toBe(userId);
        expect(data.slug).toBe(teacher.slug);
      });
    });

    await runCase('TF-33', async () => {
      const issues: string[] = [];
      const trySlug = async (slug: string) => {
        const page = await anonymousContext.newPage();
        await page.goto('/');
        await id(page, 'home-professora').click();
        await id(page, 'auth-tab-criar').click();
        await id(page, 'role-professora').click();
        await id(page, 'field-nome').fill('Teste de slug');
        await id(page, 'field-email').fill(`slug.${slug.length}.${RUN}@example.com`);
        await id(page, 'field-senha').fill(PASSWORD);
        await id(page, 'field-slug').fill(slug);
        await expect(page.getByRole('status')).toContainText('Use apenas letras minúsculas, números e hífens.');
        await id(page, 'auth-submit').click();
        await expect(id(page, 'auth-error')).toContainText('Use apenas letras minúsculas');
        await expect(id(page, 'painel-professora')).toHaveCount(0);
        await page.close();
      };
      await trySlug('ANA-TESTE');
      await trySlug('ana teste');
      await trySlug('ana-inglês');

      const page = await anonymousContext.newPage();
      await page.goto('/');
      await id(page, 'home-professora').click();
      await id(page, 'auth-tab-criar').click();
      await id(page, 'role-professora').click();
      await id(page, 'field-email').fill(`invalid.empty.${RUN}@example.com`);
      await id(page, 'field-senha').fill(PASSWORD);
      await id(page, 'auth-submit').click();
      await expect(id(page, 'painel-professora')).toHaveCount(0);

      await id(page, 'field-nome').fill('Teste duplicado');
      await id(page, 'field-email').fill(`duplicate.${RUN}@example.com`);
      await id(page, 'field-slug').fill(teacher.slug);
      await expect(page.getByText('Este link já está em uso.')).toBeVisible();
      await id(page, 'auth-submit').click();
      await expect(id(page, 'auth-error')).toBeVisible();
      await expect(id(page, 'painel-professora')).toHaveCount(0);

      await id(page, 'field-slug').fill(`password-test-${RUN}`);
      await id(page, 'field-senha').fill('short');
      await id(page, 'field-email').fill(`short.${RUN}@example.com`);
      await id(page, 'auth-submit').click();
      await expect(id(page, 'auth-error')).toBeVisible();
      await expect(id(page, 'painel-professora')).toHaveCount(0);

      await id(page, 'field-senha').fill(PASSWORD);
      await id(page, 'field-email').fill('invalid-email');
      expect(await id(page, 'field-email').evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
      await id(page, 'auth-submit').click();
      await expect(id(page, 'painel-professora')).toHaveCount(0);
      await page.close();
      expect(issues, 'A tela deveria bloquear slugs com maiúsculas, espaços ou acentos.').toEqual([]);
    });

    await test.step('TF-34', async () => {
      outcomes.push({ id: 'TF-34', status: 'N/A', detail: 'Confirm email está desativado no ambiente de testes; o caso exige ativá-lo.' });
    });

    await runCase('TF-01', async () => {
      await addLesson(teacherPage, lessonTwo);
      const { data, error } = await withAccount(teacher, (client, userId) =>
        client.from('aulas').select('nome,duracao_min,preco').eq('professora_id', userId).eq('nome', lessonTwo.nome).single(),
      );
      if (error) throw error;
      expect(data.duracao_min).toBe(30);
      expect(Number(data.preco)).toBe(39);
    });

    await runCase('TF-02', async () => {
      await id(teacherPage, 'aula-novo').click();
      await id(teacherPage, 'aula-nome').fill('En');
      await id(teacherPage, 'aula-duracao').fill('50');
      await id(teacherPage, 'aula-preco').fill('4900');
      await id(teacherPage, 'aula-salvar').click();
      await expect(id(teacherPage, 'erro-nome')).toContainText('3');
      await id(teacherPage, 'aula-cancelar').click();
      await expect(id(teacherPage, 'aula-item')).toHaveCount(1);
    });

    await runCase('TF-03', async () => {
      await addLesson(teacherPage, { nome: 'Limite de duração 15', duration: '15', cents: '1000' });
      await addLesson(teacherPage, { nome: 'Limite de duração 120', duration: '120', cents: '1000' });
      await withAccount(teacher, async (client, userId) => {
        const { data, error } = await client.from('aulas').select('duracao_min')
          .eq('professora_id', userId).in('nome', ['Limite de duração 15', 'Limite de duração 120']);
        if (error) throw error;
        expect(data?.map((row) => row.duracao_min).sort((a, b) => a - b)).toEqual([15, 120]);
      });
    });

    await runCase('TF-04', async () => {
      await id(teacherPage, 'aula-novo').click();
      await id(teacherPage, 'aula-nome').fill('Duração inválida');
      await id(teacherPage, 'aula-preco').fill('1000');
      const duration = id(teacherPage, 'aula-duracao');
      try {
        for (const value of ['14', '121', '0', '45.5', '']) {
          await duration.fill(value);
          await id(teacherPage, 'aula-salvar').click();
          await expect(id(teacherPage, 'erro-duracao')).toBeVisible();
        }
        await duration.press('a');
        await expect(duration).toHaveValue('');
        await id(teacherPage, 'aula-salvar').click();
        await expect(id(teacherPage, 'erro-duracao')).toBeVisible();
      } finally {
        if (await id(teacherPage, 'aula-cancelar').count()) {
          await id(teacherPage, 'aula-cancelar').click();
        }
      }
    });

    await runCase('TF-05', async () => {
      await id(teacherPage, 'aula-novo').click();
      const price = id(teacherPage, 'aula-preco');
      await price.fill('4900');
      await expect(price).toHaveValue(/R\$\s*49,00/);
      await price.fill('123456789');
      await expect(price).toHaveValue(/R\$\s*1\.234\.567,89/);
      await id(teacherPage, 'aula-cancelar').click();
    });

    await runCase('TF-06', async () => {
      await id(teacherPage, 'aula-novo').click();
      await id(teacherPage, 'aula-nome').fill('Preço inválido');
      await id(teacherPage, 'aula-duracao').fill('30');
      const price = id(teacherPage, 'aula-preco');
      await price.fill('0');
      await id(teacherPage, 'aula-salvar').click();
      await expect(id(teacherPage, 'erro-preco')).toBeVisible();
      await price.fill('-100');
      await id(teacherPage, 'aula-salvar').click();
      await expect(id(teacherPage, 'erro-preco')).toBeVisible();
      await id(teacherPage, 'aula-cancelar').click();
    });

    await runCase('TF-07', async () => {
      await id(teacherPage, 'aula-novo').click();
      await id(teacherPage, 'aula-nome').fill(lesson.nome);
      await id(teacherPage, 'aula-duracao').fill(lesson.duration);
      await id(teacherPage, 'aula-preco').fill(lesson.cents);
      const started = Date.now();
      await id(teacherPage, 'aula-salvar').click();
      await expect(id(teacherPage, 'aula-item').filter({ hasText: lesson.nome })).toBeVisible();
      const elapsedMs = Date.now() - started;
      lessonIdRef.value = await getLessonId(teacher.slug, lesson.nome);
      await withAccount(teacher, async (client, userId) => {
        const { data, error } = await client.from('aulas').select('id').eq('id', lessonIdRef.value)
          .eq('professora_id', userId).single();
        if (error) throw error;
        expect(data.id).toBe(lessonIdRef.value);
      });
      console.log(`TF-07 save + render: ${elapsedMs} ms`);
      expect(elapsedMs).toBeLessThan(1000);
    });

    await runCase('TF-08', async () => {
      const before = await id(teacherPage, 'aula-item').count();
      await id(teacherPage, 'aula-novo').click();
      await id(teacherPage, 'aula-nome').fill('Aula cancelada');
      await id(teacherPage, 'aula-duracao').fill('30');
      await id(teacherPage, 'aula-preco').fill('1000');
      await id(teacherPage, 'aula-cancelar').click();
      await expect(id(teacherPage, 'aula-item')).toHaveCount(before);
      const { data, error } = await withAccount(teacher, (client, userId) =>
        client.from('aulas').select('id').eq('professora_id', userId).eq('nome', 'Aula cancelada'),
      );
      if (error) throw error;
      expect(data).toHaveLength(0);
    });

    await runCase('TF-09', async () => {
      const before = await withAccount(teacher, async (client, userId) => {
        const { count, error } = await client.from('aulas').select('id', { count: 'exact', head: true }).eq('professora_id', userId);
        if (error) throw error;
        return count || 0;
      });
      await teacherPage.route('**/rest/v1/aulas**', (route) => route.abort());
      await id(teacherPage, 'aula-novo').click();
      await id(teacherPage, 'aula-nome').fill('Salvar offline');
      await id(teacherPage, 'aula-duracao').fill('30');
      await id(teacherPage, 'aula-preco').fill('1000');
      await id(teacherPage, 'aula-salvar').click();
      await expect(teacherPage.getByRole('alert')).toBeVisible();
      await expect(id(teacherPage, 'aula-nome')).toHaveValue('Salvar offline');
      await teacherPage.unroute('**/rest/v1/aulas**');
      const afterOffline = await withAccount(teacher, async (client, userId) => {
        const { count, error } = await client.from('aulas').select('id', { count: 'exact', head: true }).eq('professora_id', userId);
        if (error) throw error;
        return count || 0;
      });
      expect(afterOffline).toBe(before);
      await id(teacherPage, 'aula-salvar').click();
      await expect(id(teacherPage, 'aula-item').filter({ hasText: 'Salvar offline' })).toBeVisible();
    });

    await runCase('TF-10', async () => {
      const item = id(teacherPage, 'aula-item').filter({ hasText: lesson.nome });
      await item.getByRole('button', { name: 'Editar' }).click();
      await id(teacherPage, 'aula-preco').fill('7900');
      await id(teacherPage, 'aula-salvar').click();
      await expect(item).toContainText('R$\u00a079,00');
      await withAccount(teacher, async (client, userId) => {
        const { data, error } = await client.from('aulas').select('preco').eq('id', lessonIdRef.value)
          .eq('professora_id', userId).single();
        if (error) throw error;
        expect(Number(data.preco)).toBe(79);
      });
    });

    await runCase('TF-11', async () => {
      await addLesson(teacherPage, { nome: 'Aula sem reserva', duration: '30', cents: '1200' });
      const item = id(teacherPage, 'aula-item').filter({ hasText: 'Aula sem reserva' });
      teacherPage.once('dialog', (dialog) => dialog.accept());
      await item.getByRole('button', { name: 'Excluir' }).click();
      await expect(item).toHaveCount(0);
      const { data, error } = await withAccount(teacher, (client, userId) =>
        client.from('aulas').select('id').eq('professora_id', userId).eq('nome', 'Aula sem reserva'),
      );
      if (error) throw error;
      expect(data).toHaveLength(0);
    });

    await runCase('TF-13', async () => {
      await id(teacherPage, 'nav-disponibilidade').click();
      await addAvailability(teacherPage, dateOne);
      await expect(teacherPage.getByText(new RegExp(`${weekdays[offsetWeekday(dateOne)]}.*09:00.*12:00`))).toBeVisible();
      await id(teacherPage, 'nav-painel').click();
      const slots = await availableSlots(teacher.slug, lessonIdRef.value, dateOne);
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((entry: { inicio: string }) => {
        const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(entry.inicio));
        return time >= '09:00' && time <= '11:00';
      })).toBe(true);
    });

    await runCase('TF-14', async () => {
      await id(teacherPage, 'nav-disponibilidade').click();
      await expect(id(teacherPage, 'disp-dia')).toBeVisible();
      await expect(teacherPage.getByText(new RegExp(`${weekdays[offsetWeekday(dateOne)]}.*09:00.*12:00`))).toBeVisible();
      const countBefore = await teacherPage.getByRole('button', { name: 'Remover' }).count();
      await addAvailability(teacherPage, dateOne, '12:00', '09:00');
      await expect(id(teacherPage, 'erro-disponibilidade')).toContainText('posterior');
      await addAvailability(teacherPage, dateOne, '09:00', '09:00');
      await expect(id(teacherPage, 'erro-disponibilidade')).toContainText('posterior');
      await addAvailability(teacherPage, dateOne, '10:00', '11:00');
      await expect(id(teacherPage, 'erro-disponibilidade')).toContainText('sobrepõe');
      expect(await teacherPage.getByRole('button', { name: 'Remover' }).count()).toBe(countBefore);
      await id(teacherPage, 'nav-painel').click();
    });

    await runCase('TF-15', async () => {
      await id(teacherPage, 'nav-disponibilidade').click();
      await expect(id(teacherPage, 'disp-dia')).toBeVisible();
      await teacherPage.getByRole('button', { name: 'Remover' }).first().click();
      await expect(teacherPage.getByRole('button', { name: 'Remover' })).toHaveCount(0);
      await withAccount(teacher, async (client, userId) => {
        const { data, error } = await client.from('disponibilidades').select('id')
          .eq('professora_id', userId).eq('dia_semana', offsetWeekday(dateOne));
        if (error) throw error;
        expect(data).toHaveLength(0);
      });
      expect(await availableSlots(teacher.slug, lessonIdRef.value, dateOne)).toHaveLength(0);
      await addAvailability(teacherPage, dateOne);
      await id(teacherPage, 'nav-painel').click();
    });

    await runCase('TF-16', async () => {
      await id(teacherPage, 'nav-disponibilidade').click();
      await expect(id(teacherPage, 'disp-dia')).toBeVisible();
      await addAvailability(teacherPage, dateTwo);
      await id(teacherPage, 'bloq-data').fill(dateTwo);
      await id(teacherPage, 'bloq-adicionar').click();
      await expect(id(teacherPage, 'bloq-item')).toBeVisible();
      expect(await availableSlots(teacher.slug, lessonIdRef.value, dateTwo)).toHaveLength(0);
      await id(teacherPage, 'nav-painel').click();
    });

    await runCase('TF-17', async () => {
      await id(teacherPage, 'nav-disponibilidade').click();
      await expect(id(teacherPage, 'disp-dia')).toBeVisible();
      await id(teacherPage, 'bloq-item').getByRole('button', { name: 'Remover' }).click();
      await expect(id(teacherPage, 'bloq-item')).toHaveCount(0);
      expect((await availableSlots(teacher.slug, lessonIdRef.value, dateTwo)).length).toBeGreaterThan(0);
      await addAvailability(teacherPage, dateThree);
      await id(teacherPage, 'nav-painel').click();
      expect((await availableSlots(teacher.slug, lessonIdRef.value, dateTwo)).length).toBeGreaterThan(0);
    });

    await runCase('TF-18', async () => {
      const dates = Array.from({ length: 14 }, (_, index) => addLocalDays(todayInSaoPaulo(), index));
      const slotsByDate = await Promise.all(dates.map((date) => availableSlots(teacher.slug, lessonIdRef.value, date)));
      const offeredDates = dates.filter((_, index) => slotsByDate[index].length);
      expect(offeredDates).toContain(dateOne);
      expect(offeredDates).toContain(dateTwo);
      expect(offeredDates).toContain(dateThree);
      for (const entries of slotsByDate) {
        for (const entry of entries) {
          const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(entry.inicio));
          expect(time >= '09:00').toBe(true);
          expect(time <= '11:00').toBe(true);
        }
      }
      await openPublicLesson(anonymousPage, teacher.slug, lesson.nome);
      await chooseDate(anonymousPage, dateOne);
      const uiTimes = await slot(anonymousPage, dateOne).evaluateAll((items) => items.map((item) => item.getAttribute('data-time')));
      expect(uiTimes.length).toBeGreaterThan(0);
    });

    await runCase('TF-19', async () => {
      expect(await availableSlots(teacher.slug, lessonIdRef.value, dateFour)).toHaveLength(0);
      await id(teacherPage, 'nav-disponibilidade').click();
      await expect(id(teacherPage, 'disp-dia')).toBeVisible();
      await id(teacherPage, 'bloq-data').fill(dateTwo);
      await id(teacherPage, 'bloq-adicionar').click();
      await expect(id(teacherPage, 'bloq-item')).toBeVisible();
      expect(await availableSlots(teacher.slug, lessonIdRef.value, dateTwo)).toHaveLength(0);
      await id(teacherPage, 'bloq-item').getByRole('button', { name: 'Remover' }).click();
      await id(teacherPage, 'nav-painel').click();
    });

    await runCase('TF-40', async () => {
      await createStudent(studentPage, student, attempted);
      await withAccount(student, async (client, userId) => {
        studentIdRef.value = userId;
        const { data, error } = await client.from('perfis_alunos').select('id,telefone,consentimento_versao')
          .eq('id', userId).single();
        if (error) throw error;
        expect(data.id).toBe(userId);
        expect(data.telefone).toBeNull();
        expect(data.consentimento_versao).toBe('agendamento-v1');
      });
    });

    await runCase('TF-41', async () => {
      const page = await anonymousContext.newPage();
      const openStudentSignup = async () => {
        await page.goto('/');
        await id(page, 'home-aluno').click();
        await id(page, 'auth-tab-criar').click();
        await id(page, 'role-aluno').click();
      };
      await openStudentSignup();
      await id(page, 'field-nome').fill('Sem consentimento');
      await id(page, 'field-email').fill(`no-consent.${RUN}@example.com`);
      await id(page, 'field-senha').fill(PASSWORD);
      await id(page, 'auth-submit').click();
      await expect(id(page, 'auth-error')).toContainText('Aceite');
      await expect(id(page, 'nav-perfil')).toHaveCount(0);

      await openStudentSignup();
      await id(page, 'field-nome').fill('Email inválido');
      await id(page, 'field-email').fill('email-invalido');
      await id(page, 'field-senha').fill(PASSWORD);
      await page.getByLabel(/Aceito o uso dos meus dados para identificar minha conta/).check();
      expect(await id(page, 'field-email').evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
      await id(page, 'auth-submit').click();
      await expect(id(page, 'nav-perfil')).toHaveCount(0);

      await openStudentSignup();
      await id(page, 'field-nome').fill('Senha curta');
      await id(page, 'field-email').fill(`short.student.${RUN}@example.com`);
      await id(page, 'field-senha').fill('short');
      await page.getByLabel(/Aceito o uso dos meus dados para identificar minha conta/).check();
      await id(page, 'auth-submit').click();
      await expect(id(page, 'auth-error')).toBeVisible();
      await expect(id(page, 'nav-perfil')).toHaveCount(0);

      await openStudentSignup();
      await id(page, 'field-email').fill(`empty.name.${RUN}@example.com`);
      await id(page, 'field-senha').fill(PASSWORD);
      await page.getByLabel(/Aceito o uso dos meus dados para identificar minha conta/).check();
      await id(page, 'auth-submit').click();
      await expect(id(page, 'nav-perfil')).toHaveCount(0);
      await page.close();
    });

    await runCase('TF-20', async () => {
      await openPublicLesson(studentPage, teacher.slug, lesson.nome);
      await chooseDate(studentPage, dateOne);
      await slot(studentPage, dateOne, firstTime).click();
      await id(studentPage, 'consentimento').check();
      await id(studentPage, 'confirmar-reserva').click();
      await expect(id(studentPage, 'reserva-confirmada')).toContainText(lesson.nome);
      await expect(id(studentPage, 'reserva-confirmada')).toContainText(/79,00/);
      await expect(id(studentPage, 'reserva-confirmada')).toContainText(firstTime);
      await expect(id(studentPage, 'reserva-confirmada')).toContainText(formatLocalDate(dateOne, { dateStyle: 'medium' }));
      await withAccount(student, async (client, userId) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        const row = data.find((booking: { inicio: string }) =>
          new Date(booking.inicio).getTime() === new Date(dateTime(dateOne, firstTime)).getTime(),
        );
        expect(row).toBeTruthy();
        bookingOneRef.value = row.id;
        const { data: stored, error: storedError } = await client.from('agendamentos')
          .select('aluno_id,consentimento_versao,consentimento_lgpd_em')
          .eq('id', bookingOneRef.value).single();
        if (storedError) throw storedError;
        expect(stored.aluno_id).toBeTruthy();
        expect(stored.consentimento_versao).toBe('agendamento-v1');
        expect(stored.consentimento_lgpd_em).toBeTruthy();
      });
    });

    await runCase('TF-21', async () => {
      await openPublicLesson(studentPage, teacher.slug, lesson.nome);
      await chooseDate(studentPage, dateThree);
      await slot(studentPage, dateThree, '09:00').click();
      const before = await withAccount(student, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        return data.length;
      });
      await id(studentPage, 'confirmar-reserva').click();
      await expect(studentPage.getByRole('alert')).toContainText('consentimento');
      const after = await withAccount(student, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        return data.length;
      });
      expect(after).toBe(before);
      await openPublicLesson(anonymousPage, teacher.slug, lesson.nome);
      await chooseDate(anonymousPage, dateThree);
      await slot(anonymousPage, dateThree, '09:00').click();
      await id(anonymousPage, 'continuar-login').click();
      await expect(id(anonymousPage, 'auth-tab-entrar')).toBeVisible();
      await expect(anonymousPage).toHaveURL(new RegExp(`professora=${teacher.slug}`));
    });

    await runCase('TF-43', async () => {
      await openPublicLesson(studentTwoPage, teacher.slug, lesson.nome);
      await chooseDate(studentTwoPage, dateThree);
      await slot(studentTwoPage, dateThree, studentTwoTime).click();
      await id(studentTwoPage, 'continuar-login').click();
      await createStudent(studentTwoPage, studentTwo, attempted, true);
      await expect(slot(studentTwoPage, dateThree, studentTwoTime)).toHaveAttribute('aria-pressed', 'true');
      await id(studentTwoPage, 'consentimento').check();
      await id(studentTwoPage, 'confirmar-reserva').click();
      await expect(id(studentTwoPage, 'reserva-confirmada')).toContainText(lesson.nome);
      await withAccount(studentTwo, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        const booking = data.find((entry: { inicio: string }) =>
          new Date(entry.inicio).getTime() === new Date(dateTime(dateThree, studentTwoTime)).getTime(),
        );
        expect(booking).toBeTruthy();
        studentTwoBookingRef.value = booking.id;
      });
    });

    await runCase('TF-47', async () => {
      await openStudentDashboard(studentTwoPage);
      await id(studentTwoPage, 'logout').click();
      await expect(studentTwoPage.getByTestId('home-aluno')).toBeVisible();
      await signInUI(studentTwoPage, studentTwo, 'aluno', 'Senha-errada-123');
      await expect(id(studentTwoPage, 'auth-error')).toContainText('incorretos');
      await signInUI(studentTwoPage, studentTwo, 'aluno');
      await expect(id(studentTwoPage, 'nav-perfil')).toBeVisible();
      await id(studentTwoPage, 'logout').click();
      await expect(studentTwoPage.getByTestId('home-aluno')).toBeVisible();
    });

    await runCase('TF-42', async () => {
      await signInUI(studentTwoPage, studentTwo, 'aluno');
      await expect(id(studentTwoPage, 'nav-perfil')).toBeVisible();
      await expect(id(studentTwoPage, 'reserva-item').first()).toContainText(lesson.nome);
      await openStudentDashboard(studentPage);
      await expect(id(studentPage, 'reserva-item').first()).toContainText(lesson.nome);
      await id(studentPage, 'logout').click();
      await expect(studentPage.getByTestId('home-aluno')).toBeVisible();
      await signInUI(studentPage, student, 'aluno');
      await expect(id(studentPage, 'nav-perfil')).toBeVisible();
      await expect(id(studentPage, 'reserva-item').first()).toContainText(lesson.nome);
      await expect(id(studentPage, 'reserva-item')).not.toContainText(studentTwo.nome);
      await id(studentTwoPage, 'logout').click();
    });

    await runCase('TF-22', async () => {
      await openPublicLesson(anonymousPage, teacher.slug, lesson.nome);
      await chooseDate(anonymousPage, dateOne);
      await expect(slot(anonymousPage, dateOne, firstTime)).toHaveCount(0);
    });

    await runCase('TF-23', async () => {
      const target = await availableSlots(teacher.slug, lessonIdRef.value, dateThree);
      const targetTime = target.find((entry: { inicio: string }) =>
        new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(entry.inicio)) === raceTime,
      );
      expect(targetTime).toBeTruthy();
      const create = async (account: typeof student | typeof studentTwo) => withAccount(account, async (client) => {
        return client.rpc('criar_agendamento', {
          p_slug: teacher.slug,
          p_aula_id: lessonIdRef.value,
          p_inicio: targetTime.inicio,
          p_aceite_lgpd: true,
        });
      });
      const first = await create(student);
      expect(first.error).toBeNull();
      const second = await create(studentTwo);
      expect(second.error).not.toBeNull();
      await withAccount(student, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        expect(data.filter((booking: { inicio: string; status: string }) =>
          booking.inicio === targetTime.inicio && ['pendente', 'confirmado'].includes(booking.status),
        )).toHaveLength(1);
      });
    });

    await runCase('TF-24', async () => {
      await openStudentDashboard(studentPage);
      const bookingCard = id(studentPage, 'reserva-item').filter({ hasText: firstTime });
      await expect(bookingCard).toContainText(lesson.nome);
      await expect(bookingCard).toContainText(formatLocalDate(dateOne, { dateStyle: 'long' }));
      await withAccount(student, async (client, userId) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        const booking = data.find((entry: { id: string }) => entry.id === bookingOneRef.value);
        expect(booking).toBeTruthy();
        expect(Number(booking.preco)).toBe(79);
        expect(booking.aula_nome).toBe(lesson.nome);
        expect(userId).toBe(studentIdRef.value);
      });
    });

    await runCase('TF-12', async () => {
      const item = id(teacherPage, 'aula-item').filter({ hasText: lesson.nome });
      teacherPage.once('dialog', (dialog) => dialog.accept());
      await item.getByRole('button', { name: 'Excluir' }).click();
      await expect(teacherPage.getByRole('alert')).toBeVisible();
      await teacherPage.reload();
      await expect(id(teacherPage, 'painel-professora')).toBeVisible();
      await expect(id(teacherPage, 'aula-item').filter({ hasText: lesson.nome })).toBeVisible();
    });

    await runCase('TF-25', async () => {
      await openPublicLesson(studentPage, teacher.slug, lesson.nome);
      await studentPage.evaluate(() => {
        window.name = '0';
        document.addEventListener('click', () => {
          window.name = String(Number(window.name) + 1);
        }, true);
      });
      const start = Date.now();
      await slot(studentPage, dateOne, '10:00').click();
      await id(studentPage, 'consentimento').check();
      await id(studentPage, 'confirmar-reserva').click();
      await expect(id(studentPage, 'reserva-confirmada')).toBeVisible();
      const elapsed = Date.now() - start;
      const clickCount = Number(await studentPage.evaluate(() => window.name));
      console.log(`TF-25 reserva existente: ${clickCount} cliques, ${elapsed} ms`);
      expect(clickCount).toBeLessThanOrEqual(3);
      expect(elapsed).toBeLessThan(60_000);
      expect(elapsed).toBeGreaterThanOrEqual(0);
      await withAccount(student, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        bookingTwoRef.value = data.find((entry: { inicio: string }) =>
          new Date(entry.inicio).getTime() === new Date(dateTime(dateOne, '10:00')).getTime(),
        )?.id || '';
        expect(bookingTwoRef.value).toBeTruthy();
      });
    });

    await runCase('TF-26', async () => {
      await saveLeadTime(teacherPage, '0');
      await openStudentDashboard(studentPage);
      await expect(id(studentPage, 'reserva-item').first().getByTestId('btn-cancelar')).toBeVisible();
    });

    await runCase('TF-27', async () => {
      await saveLeadTime(teacherPage, '72');
      await openStudentDashboard(studentPage);
      await expect(id(studentPage, 'reserva-item').filter({ hasText: lesson.nome }).first().getByTestId('msg-fora-prazo')).toBeVisible();
      await expect(id(studentPage, 'reserva-item').filter({ hasText: lesson.nome }).first().getByTestId('btn-cancelar')).toHaveCount(0);
      const { error } = await withAccount(student, (client) =>
        client.rpc('cancelar_agendamento', { p_agendamento_id: bookingOneRef.value }),
      );
      expect(error).not.toBeNull();
      await saveLeadTime(teacherPage, '0');
      await openStudentDashboard(studentPage);
    });

    await runCase('TF-28', async () => {
      const booking = id(studentPage, 'reserva-item').filter({ hasText: '10:00' });
      studentPage.once('dialog', (dialog) => dialog.dismiss());
      await booking.getByTestId('btn-cancelar').click();
      await expect(booking).toContainText(/confirmado/i);
      studentPage.once('dialog', (dialog) => dialog.accept());
      await booking.getByTestId('btn-cancelar').click();
      await expect(booking).toContainText(/cancelado/i);
    });

    await runCase('TF-29', async () => {
      await withAccount(student, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        const canceled = data.find((entry: { id: string }) => entry.id === bookingTwoRef.value);
        expect(canceled?.status).toBe('cancelado');
      });
      await withAccount(teacher, async (client) => {
        const { data, error } = await client.from('notificacoes').select('id')
          .eq('agendamento_id', bookingTwoRef.value).eq('tipo', 'cancelamento');
        if (error) throw error;
        expect(data).toHaveLength(1);
      });
      const released = await availableSlots(teacher.slug, lessonIdRef.value, dateOne);
      expect(released.some((entry: { inicio: string }) =>
        new Date(entry.inicio).getTime() === new Date(dateTime(dateOne, '10:00')).getTime(),
      )).toBe(true);
      await id(teacherPage, 'nav-agenda').click();
      await id(teacherPage, 'agenda-data').fill(dateOne);
      await expect(id(teacherPage, 'agenda-data')).toHaveValue(dateOne);
      const canceledAgendaEntry = id(teacherPage, 'agenda-item').filter({ hasText: student.nome });
      await expect(canceledAgendaEntry).toBeVisible();
      await expect(canceledAgendaEntry).toContainText('cancelado');
    });

    await runCase('TF-30', async () => {
      await openStudentDashboard(studentPage);
      const booking = id(studentPage, 'reserva-item').filter({ hasText: firstTime });
      await booking.getByRole('button', { name: 'Reagendar' }).click();
      const select = studentPage.getByLabel('Novo horário');
      await expect(select).toBeVisible();
      const options = await select.locator('option').allTextContents();
      expect(options.length).toBeGreaterThan(0);
      const targetOption = await select.locator('option').first().getAttribute('value');
      expect(targetOption).toBeTruthy();
      await select.selectOption(targetOption!);
      await booking.getByRole('button', { name: 'Confirmar novo horário' }).click();
      await expect(studentPage.getByText('Aula reagendada.')).toBeVisible();
      await withAccount(student, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        const moved = data.find((entry: { id: string }) => entry.id === bookingOneRef.value);
        expect(moved.inicio).not.toBe(dateTime(dateOne, firstTime));
      });
    });

    await runCase('TF-31', async () => {
      const occupied = dateTime(dateThree, studentTwoTime);
      const before = await withAccount(student, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        return data.find((entry: { id: string }) => entry.id === bookingOneRef.value)?.inicio;
      });
      const { error } = await withAccount(student, (client) => client.rpc('reagendar_agendamento', {
        p_agendamento_id: bookingOneRef.value,
        p_novo_inicio: occupied,
      }));
      expect(error).not.toBeNull();
      const after = await withAccount(student, async (client) => {
        const { data, error: queryError } = await client.rpc('listar_meus_agendamentos');
        if (queryError) throw queryError;
        return data.find((entry: { id: string }) => entry.id === bookingOneRef.value)?.inicio;
      });
      expect(after).toBe(before);
    });

    await runCase('TF-35', async () => {
      await createTeacher(teacherTwoPage, teacherTwo, attempted);
      await addLesson(teacherTwoPage, { nome: 'Aula privada da segunda professora', duration: '30', cents: '2500' });
      await id(teacherTwoPage, 'nav-disponibilidade').click();
      await addAvailability(teacherTwoPage, dateOne);
      await withAccount(teacherTwo, async (client, userId) => {
        const { data, error } = await client.from('aulas').select('id').eq('professora_id', userId);
        if (error) throw error;
        expect(data.length).toBeGreaterThan(0);
      });
      await withAccount(teacher, async (client) => {
        const { data, error } = await client.from('aulas').select('id').eq('professora_id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        expect(data).toHaveLength(0);
      });
      const bUser = await withAccount(teacherTwo, async (_client, userId) => userId);
      await withAccount(teacher, async (client) => {
        const { data, error } = await client.from('aulas').select('id').eq('professora_id', bUser);
        if (error) throw error;
        expect(data).toHaveLength(0);
      });
      await id(teacherTwoPage, 'nav-painel').click();
    });

    await runCase('TF-36', async () => {
      const requestRecovery = async (email: string) => {
        await anonymousPage.goto('/');
        await anonymousPage.getByRole('button', { name: 'Acesso do(a) Professor(a)' }).click();
        await anonymousPage.getByRole('button', { name: 'Esqueci minha senha' }).click();
        await id(anonymousPage, 'field-email').fill(email);
        await id(anonymousPage, 'auth-submit').click();
        const status = anonymousPage.getByRole('status');
        const error = id(anonymousPage, 'auth-error');
        await expect.poll(async () =>
          (await status.count() > 0 && await status.isVisible()) || await error.isVisible(),
        ).toBe(true);
        if (await error.isVisible()) return await error.innerText();
        return await status.innerText();
      };
      const known = await requestRecovery(teacher.email);
      const unknown = await requestRecovery(`unknown.${RUN}@example.com`);
      console.log(`TF-36 recovery UI: known=${JSON.stringify(known)}; unknown=${JSON.stringify(unknown)}`);
      expect(known).not.toMatch(/e-mail não cadastrado|conta não existe|nenhuma conta encontrada/i);
      expect(unknown).not.toMatch(/e-mail não cadastrado|conta não existe|nenhuma conta encontrada/i);
    }, 'Parcial');

    await runCase('TF-37', async () => {
      await teacherPage.goto('/');
      await expect(id(teacherPage, 'painel-professora')).toBeVisible();
      await id(teacherPage, 'nav-perfil').click();
      await teacherPage.getByLabel('Nome').fill('Professora Funcional Atualizada');
      await teacherPage.getByLabel('Telefone (opcional)').fill('41988887777');
      await id(teacherPage, 'perfil-antecedencia').fill('24');
      await id(teacherPage, 'perfil-salvar').click();
      await expect(id(teacherPage, 'toast-sucesso')).toBeVisible();
      await withAccount(teacher, async (client, userId) => {
        const { data, error } = await client.from('perfis').select('nome,telefone,antecedencia_cancelamento_horas')
          .eq('id', userId).single();
        if (error) throw error;
        expect(data.nome).toBe('Professora Funcional Atualizada');
        expect(data.telefone).toBe('41988887777');
        expect(data.antecedencia_cancelamento_horas).toBe(24);
      });
      await id(teacherPage, 'nav-painel').click();
      await openPublicLesson(anonymousPage, teacher.slug, lesson.nome);
      await expect(anonymousPage.getByLabel('Professor(a)')).toContainText('Professora Funcional Atualizada');
    });

    await runCase('TF-38', async () => {
      await teacherPage.goto('/');
      await expect(id(teacherPage, 'painel-professora')).toBeVisible();
      await id(teacherPage, 'nav-perfil').click();
      for (const value of ['-1', '73', '1.5', '']) {
        await id(teacherPage, 'perfil-antecedencia').fill(value);
        await id(teacherPage, 'perfil-salvar').click();
        await expect(id(teacherPage, 'toast-sucesso')).toHaveCount(0);
      }
      await withAccount(teacher, async (client, userId) => {
        const { data, error } = await client.from('perfis').select('antecedencia_cancelamento_horas')
          .eq('id', userId).single();
        if (error) throw error;
        expect(data.antecedencia_cancelamento_horas).toBe(24);
      });
      await id(teacherPage, 'perfil-antecedencia').fill('0');
      await id(teacherPage, 'perfil-salvar').click();
      await id(teacherPage, 'nav-painel').click();
    });

    await runCase('TF-39', async () => {
      await id(teacherTwoPage, 'nav-perfil').click();
      teacherTwoPage.once('dialog', (dialog) => dialog.dismiss());
      await id(teacherTwoPage, 'perfil-excluir').click();
      await expect(id(teacherTwoPage, 'perfil-excluir')).toBeVisible();
      await withAccount(teacherTwo, async (client, userId) => {
        const { data, error } = await client.from('perfis').select('id').eq('id', userId).single();
        if (error) throw error;
        expect(data.id).toBe(userId);
      });
      teacherTwoPage.once('dialog', (dialog) => dialog.accept());
      await id(teacherTwoPage, 'perfil-excluir').click();
      await expect(teacherTwoPage.getByTestId('home-professora')).toBeVisible();
      const { error } = await anonClient().auth.signInWithPassword({ email: teacherTwo.email, password: PASSWORD });
      expect(error).not.toBeNull();
      await withAccount(teacher, async (client, userId) => {
        const { data, error: queryError } = await client.from('perfis').select('id').eq('id', userId).single();
        if (queryError) throw queryError;
        expect(data.id).toBe(userId);
      });
    });

    await runCase('TF-44', async () => {
      await openStudentDashboard(studentPage);
      await id(studentPage, 'nav-perfil').click();
      await studentPage.getByLabel('Nome').fill('Aluno Funcional Editado');
      await studentPage.getByLabel('Telefone (opcional)').fill('11977776666');
      await id(studentPage, 'perfil-salvar').click();
      await expect(id(studentPage, 'toast-sucesso')).toBeVisible();
      await withAccount(student, async (client, userId) => {
        const { data, error } = await client.from('perfis_alunos').select('nome,telefone').eq('id', userId).single();
        if (error) throw error;
        expect(data.nome).toBe('Aluno Funcional Editado');
        expect(data.telefone).toBe('11977776666');
      });
      await id(studentPage, 'nav-painel').click();
      await expect(studentPage.getByRole('button', { name: 'Reagendar' }).first()).toBeVisible();
    });

    await runCase('TF-45', async () => {
      const before = await withAccount(studentTwo, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        return data.map((booking: { id: string }) => booking.id);
      });
      expect(before.length).toBeGreaterThan(0);
      await openStudentDashboard(studentPage);
      await id(studentPage, 'nav-perfil').click();
      studentPage.once('dialog', (dialog) => dialog.dismiss());
      await id(studentPage, 'perfil-excluir').click();
      await expect(id(studentPage, 'perfil-excluir')).toBeVisible();
      await withAccount(student, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        expect(data.length).toBeGreaterThan(0);
      });
      studentPage.once('dialog', (dialog) => dialog.accept());
      await id(studentPage, 'perfil-excluir').click();
      await expect(studentPage.getByTestId('home-aluno')).toBeVisible();
      const { error } = await anonClient().auth.signInWithPassword({ email: student.email, password: PASSWORD });
      expect(error).not.toBeNull();
      await withAccount(studentTwo, async (client) => {
        const { data, error: queryError } = await client.rpc('listar_meus_agendamentos');
        if (queryError) throw queryError;
        expect(data.map((booking: { id: string }) => booking.id)).toEqual(before);
      });
      await withAccount(teacher, async (client) => {
        const { data, error: queryError } = await client.from('agendamentos').select('aluno_nome')
          .eq('professora_id', (await client.auth.getUser()).data.user?.id);
        if (queryError) throw queryError;
        expect(data.every((booking) => booking.aluno_nome !== 'Aluno Funcional Editado')).toBe(true);
      });
    });

    await runCase('TF-46', async () => {
      const offlineEmail = `offline.${RUN}@example.com`;
      await anonymousPage.goto('/');
      await id(anonymousPage, 'home-aluno').click();
      await id(anonymousPage, 'auth-tab-criar').click();
      await id(anonymousPage, 'role-aluno').click();
      await id(anonymousPage, 'field-nome').fill('Cadastro offline');
      await id(anonymousPage, 'field-email').fill(offlineEmail);
      await id(anonymousPage, 'field-senha').fill(PASSWORD);
      await anonymousPage.getByLabel(/Aceito o uso dos meus dados para identificar minha conta/).check();
      await anonymousPage.route('**/auth/v1/signup**', (route) => route.abort());
      await id(anonymousPage, 'auth-submit').click();
      await expect(id(anonymousPage, 'auth-error')).toBeVisible();
      await expect(id(anonymousPage, 'field-nome')).toHaveValue('Cadastro offline');
      await anonymousPage.unroute('**/auth/v1/signup**');

      const before = await withAccount(studentTwo, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        return data.length;
      });
      await signInUI(studentTwoPage, studentTwo, 'aluno');
      await expect(id(studentTwoPage, 'nav-perfil')).toBeVisible();
      await openPublicLesson(studentTwoPage, teacher.slug, lesson.nome);
      await chooseDate(studentTwoPage, dateOne);
      const freeSlot = await slot(studentTwoPage, dateOne).first().getAttribute('data-time');
      expect(freeSlot).toBeTruthy();
      await slot(studentTwoPage, dateOne, freeSlot!).click();
      await id(studentTwoPage, 'consentimento').check();
      await studentTwoPage.route('**/rest/v1/rpc/criar_agendamento**', (route) => route.abort());
      await id(studentTwoPage, 'confirmar-reserva').click();
      await expect(studentTwoPage.getByRole('alert')).toBeVisible();
      await studentTwoPage.unroute('**/rest/v1/rpc/criar_agendamento**');
      const after = await withAccount(studentTwo, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        return data.length;
      });
      expect(after).toBe(before);

      await studentTwoPage.goto('/');
      await expect(id(studentTwoPage, 'nav-perfil')).toBeVisible();
      const booking = id(studentTwoPage, 'reserva-item').filter({ hasText: studentTwoTime });
      await studentTwoPage.route('**/rest/v1/rpc/cancelar_agendamento**', (route) => route.abort());
      studentTwoPage.once('dialog', (dialog) => dialog.accept());
      await booking.getByTestId('btn-cancelar').click();
      await expect(studentTwoPage.getByRole('alert')).toBeVisible();
      await studentTwoPage.unroute('**/rest/v1/rpc/cancelar_agendamento**');
      await withAccount(studentTwo, async (client) => {
        const { data, error } = await client.rpc('listar_meus_agendamentos');
        if (error) throw error;
        expect(data.some((entry: { id: string; status: string }) =>
          entry.id === studentTwoBookingRef.value && entry.status === 'confirmado',
        )).toBe(true);
      });
    });

    await runCase('TF-48', async () => {
      await studentTwoPage.goto('/');
      await expect(id(studentTwoPage, 'painel-professora')).toHaveCount(0);
      await withAccount(studentTwo, async (client) => {
        const { data, error } = await client.from('aulas').select('id');
        if (error && ![401, 403].includes(error.status || 0)) throw error;
        expect(data || []).toHaveLength(0);
        const { error: roleError } = await client.rpc('garantir_perfil', {
          p_papel: 'professora',
          p_nome: studentTwo.nome,
          p_telefone: studentTwo.telefone,
          p_slug: `wrong-role-${RUN}`,
          p_aceite_lgpd: true,
        });
        expect(roleError).not.toBeNull();
      });
      await withAccount(teacher, async (client) => {
        const { error } = await client.rpc('garantir_perfil', {
          p_papel: 'aluno',
          p_nome: teacher.nome,
          p_telefone: teacher.telefone,
          p_aceite_lgpd: true,
        });
        expect(error).not.toBeNull();
      });
    });

    await runCase('TF-49', async () => {
      for (const table of ['agendamentos', 'perfis_alunos', 'notificacoes']) {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=5`, {
          headers: { apikey: supabaseAnonKey!, Authorization: `Bearer ${supabaseAnonKey}` },
        });
        if ([401, 403].includes(response.status)) {
          continue;
        } else {
          expect(response.status).toBe(200);
          expect(await response.json()).toHaveLength(0);
        }
      }
    });

    await runCase('TF-50', async () => {
      await withAccount(teacher, async (client) => {
        const { data, error } = await client.from('notificacoes')
          .select('tipo,enviada_em').eq('agendamento_id', studentTwoBookingRef.value);
        if (error) throw error;
        expect(data.map((row) => row.tipo).sort()).toEqual(['confirmacao', 'lembrete_24h']);
        expect(data.every((row) => row.enviada_em === null)).toBe(true);
      });
    });

    await runCase('TF-51', async () => {
      const before = await withAccount(teacher, async (client) => {
        const { count, error } = await client.from('agendamentos').select('id', { count: 'exact', head: true });
        if (error) throw error;
        return count || 0;
      });
      await openPublicLesson(teacherPage, teacher.slug, lesson.nome);
      await chooseDate(teacherPage, dateThree);
      await expect(teacherPage.getByText(/conectado como Professor/)).toBeVisible();
      await expect(teacherPage.getByRole('button', { name: 'Sair e entrar como Aluno(a)' })).toBeVisible();
      const after = await withAccount(teacher, async (client) => {
        const { count, error } = await client.from('agendamentos').select('id', { count: 'exact', head: true });
        if (error) throw error;
        return count || 0;
      });
      expect(after).toBe(before);
    });

    await runCase('TF-52', async () => {
      const invalid = await withAccount(studentTwo, async (client) => {
        const before = await client.rpc('listar_meus_agendamentos');
        if (before.error) throw before.error;
        const outOfRange = await client.rpc('criar_agendamento', {
          p_slug: teacher.slug,
          p_aula_id: lessonIdRef.value,
          p_inicio: dateTime(dateThree, '03:00'),
          p_aceite_lgpd: true,
        });
        const overlap = await client.rpc('criar_agendamento', {
          p_slug: teacher.slug,
          p_aula_id: lessonIdRef.value,
          p_inicio: dateTime(dateThree, studentTwoTime),
          p_aceite_lgpd: true,
        });
        const after = await client.rpc('listar_meus_agendamentos');
        if (after.error) throw after.error;
        return { outOfRange: outOfRange.error, overlap: overlap.error, before: before.data.length, after: after.data.length };
      });
      expect(invalid.outOfRange).not.toBeNull();
      expect(invalid.overlap).not.toBeNull();
      expect(invalid.after).toBe(invalid.before);
    });

  } finally {
    const cleanupFailures: string[] = [];
    for (const [email, role] of attempted) {
      try {
        await removeAccount({ email }, role);
      } catch {
        cleanupFailures.push(role);
      }
    }
    await Promise.all(contexts.map((context) => context.close()));
    console.log(`FUNCTIONAL_52_RESULT ${JSON.stringify(outcomes)}`);
    console.log(`FUNCTIONAL_52_COUNTS ${JSON.stringify({
      total: outcomes.length,
      passed: outcomes.filter((item) => item.status === 'Aprovado').length,
      failed: outcomes.filter((item) => item.status === 'Reprovado').length,
      partial: outcomes.filter((item) => item.status === 'Parcial').length,
      notApplicable: outcomes.filter((item) => item.status === 'N/A').length,
      cleanupFailures,
    })}`);
    expect(outcomes.map((item) => item.id).filter((caseId) => caseId.startsWith('TF-')).length).toBe(52);
    expect(outcomes.filter((item) => item.status === 'Reprovado'), JSON.stringify(outcomes.filter((item) => item.status === 'Reprovado'))).toEqual([]);
    expect(cleanupFailures).toEqual([]);
  }
});
