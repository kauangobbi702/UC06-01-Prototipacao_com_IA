import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { Button } from './components/Button.jsx';
import { Card } from './components/Card.jsx';
import { ErrorState } from './components/ErrorState.jsx';
import { Input } from './components/Input.jsx';
import { LoadingState } from './components/LoadingState.jsx';
import { useAppContext } from './context/AppContext.jsx';
import { ProfilePage } from './features/profile/ProfilePage.jsx';
import { StudentBookingPage } from './features/student/StudentBookingPage.jsx';
import { StudentDashboardPage } from './features/student/StudentDashboardPage.jsx';
import { TeacherAvailabilityPage } from './features/teacher/TeacherAvailabilityPage.jsx';
import { TeacherDailyAgendaPage } from './features/teacher/TeacherDailyAgendaPage.jsx';
import { TeacherLessonFormPage } from './features/teacher/TeacherLessonFormPage.jsx';
import { TeacherLessonsPage } from './features/teacher/TeacherLessonsPage.jsx';
import { getSupabaseErrorMessage, STATUS } from './lib/status.js';

function publicSlugFromLocation() {
  return new URLSearchParams(window.location.search).get('professora')?.trim().toLowerCase() || '';
}

function slugify(value) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

export function App() {
  const {
    session,
    authEvent,
    user,
    profile,
    setProfile,
    setRole,
    role,
    authStatus,
    authError,
    setAuthError,
    refreshSession,
  } = useAppContext();
  const [view, setView] = useState(publicSlugFromLocation() ? 'public' : 'home');
  const [authMode, setAuthMode] = useState('login');
  const [authRole, setAuthRole] = useState('professora');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState({ state: 'idle', message: '' });
  const [studentConsent, setStudentConsent] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [editingLesson, setEditingLesson] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (authEvent === 'PASSWORD_RECOVERY') setView('password-reset');
  }, [authEvent]);

  useEffect(() => {
    if (view !== 'auth' || authMode !== 'signup' || authRole !== 'professora' || !supabase) {
      setSlugStatus({ state: 'idle', message: '' });
      return undefined;
    }

    const candidate = slugify(slug);
    if (candidate.length < 3) {
      setSlugStatus({ state: 'idle', message: 'Informe ao menos 3 caracteres.' });
      return undefined;
    }

    let active = true;
    setSlugStatus({ state: 'checking', message: 'Verificando disponibilidade...' });
    const timer = window.setTimeout(async () => {
      try {
        const { data: available, error } = await supabase.rpc('slug_disponivel', {
          p_slug: candidate,
        });
        if (!active) return;
        if (error) {
          setSlugStatus({ state: 'error', message: 'Não foi possível verificar agora.' });
        } else {
          setSlugStatus(available
            ? { state: 'available', message: 'Link disponível.' }
            : { state: 'unavailable', message: 'Este link já está em uso.' });
        }
      } catch {
        if (active) setSlugStatus({ state: 'error', message: 'Não foi possível verificar agora.' });
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [authMode, authRole, slug, view]);

  useEffect(() => {
    if (authStatus === STATUS.LOADING || authEvent === 'PASSWORD_RECOVERY' || !session?.user || !supabase) return undefined;
    let active = true;

    async function initializeProfile() {
      try {
        const { data: currentRole, error: roleError } = await supabase.rpc('papel_atual');
        if (roleError) throw roleError;

        const metadata = session.user.user_metadata || {};
        const nextRole = currentRole || metadata.papel || 'professora';
        if (!['professora', 'aluno'].includes(nextRole)) {
          throw new Error('O perfil desta conta não possui um papel válido.');
        }
        if (!active) return;
        setRole(nextRole);

        if (nextRole === 'aluno' && metadata.aceite_lgpd !== true) {
          const { data: existingStudent, error: studentError } = await supabase
            .from('perfis_alunos')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();
          if (studentError) throw studentError;
          if (!existingStudent) {
            setView('student-consent');
            return;
          }
        }

        const profileName = String(metadata.nome || session.user.email?.split('@')[0] || 'Usuário').trim();
        const profileSlug = String(metadata.slug || slugify(profileName) || 'professora');
        const { data: profileData, error: profileError } = await supabase.rpc('garantir_perfil', {
          p_papel: nextRole,
          p_nome: profileName,
          p_telefone: metadata.telefone || null,
          p_slug: profileSlug,
          p_aceite_lgpd: true,
        });
        if (profileError) throw profileError;
        if (!active) return;
        setProfile(profileData);
        setView(nextRole === 'professora'
          ? 'teacher'
          : (publicSlugFromLocation() ? 'public' : 'student'));
      } catch (error) {
        if (!active) return;
        setAuthError(getSupabaseErrorMessage(error));
        setView('error');
      }
    }

    initializeProfile();
    return () => {
      active = false;
    };
  }, [authEvent, authStatus, session?.user?.id, setProfile, setRole, setAuthError]);

  async function submitAuth(event) {
    event.preventDefault();
    setFormBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      if (authMode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setAuthMessage('Se existir uma conta para este e-mail, você receberá as instruções para redefinir a senha.');
        return;
      }

      if (authMode === 'signup') {
        if (authRole === 'aluno' && !studentConsent) {
          throw new Error('Aceite o uso dos dados para criar sua conta de aluno.');
        }
        if (authRole === 'professora') {
          const normalizedSlug = slugify(slug || name);
          if (normalizedSlug.length < 3) throw new Error('O link público deve ter ao menos 3 caracteres.');
          const { data: available, error: slugError } = await supabase.rpc('slug_disponivel', {
            p_slug: normalizedSlug,
          });
          if (slugError) throw slugError;
          if (!available) throw new Error('Este link já está em uso. Escolha outro nome para o seu link.');
        }

        const metadata = {
          nome: name.trim(),
          papel: authRole,
          telefone: phone.trim() || null,
          aceite_lgpd: authRole === 'aluno' && studentConsent,
        };
        if (authRole === 'professora') metadata.slug = slugify(slug || name);
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: metadata },
        });
        if (error) throw error;
        if (!data.session) {
          setAuthMessage('Conta criada. Confirme o e-mail recebido e depois entre para continuar.');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      await refreshSession();
    } catch (error) {
      const message = String(error?.message || '');
      if (error?.code === 'email_not_confirmed' || /email.*not confirmed/i.test(message)) {
        setAuthError('Confirme seu e-mail pelo link recebido antes de entrar.');
      } else if (message === 'Invalid login credentials') {
        setAuthError('E-mail ou senha incorretos.');
      } else {
        setAuthError(getSupabaseErrorMessage(error));
      }
    } finally {
      setFormBusy(false);
    }
  }

  async function finishStudentConsent() {
    if (!studentConsent) {
      setAuthError('Aceite o uso dos dados para continuar.');
      return;
    }
    setFormBusy(true);
    setAuthError('');
    try {
      const metadata = user.user_metadata || {};
      const profileName = String(metadata.nome || user.email?.split('@')[0] || 'Aluno').trim();
      const { data, error } = await supabase.rpc('garantir_perfil', {
        p_papel: 'aluno',
        p_nome: profileName,
        p_telefone: metadata.telefone || null,
        p_slug: null,
        p_aceite_lgpd: true,
      });
      if (error) throw error;
      setProfile(data);
      setRole('aluno');
      setView(publicSlugFromLocation() ? 'public' : 'student');
    } catch (error) {
      setAuthError(getSupabaseErrorMessage(error));
    } finally {
      setFormBusy(false);
    }
  }

  async function saveNewPassword(event) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setAuthError('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setAuthError('As senhas informadas não correspondem.');
      return;
    }
    setFormBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setAuthMessage('Senha alterada. Sua conta está pronta para uso.');
      setNewPassword('');
      setNewPasswordConfirmation('');
      setView(role === 'professora' ? 'teacher' : 'student');
    } catch (error) {
      setAuthError(getSupabaseErrorMessage(error));
    } finally {
      setFormBusy(false);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(getSupabaseErrorMessage(error));
      setView('error');
      return;
    }
    setProfile(null);
    setRole(null);
    setView(publicSlugFromLocation() ? 'public' : 'home');
  }

  async function saveProfile(values) {
    const table = role === 'professora' ? 'perfis' : 'perfis_alunos';
    const updateValues = role === 'professora'
      ? {
        nome: values.nome,
        telefone: values.telefone,
        slug: values.slug,
        antecedencia_cancelamento_horas: values.antecedencia_cancelamento_horas,
      }
      : { nome: values.nome, telefone: values.telefone };
    if (role === 'professora' && (
      !Number.isInteger(values.antecedencia_cancelamento_horas)
      || values.antecedencia_cancelamento_horas < 0
      || values.antecedencia_cancelamento_horas > 72
    )) {
      throw new Error('Informe uma antecedência inteira entre 0 e 72 horas.');
    }
    if (role === 'professora' && values.slug !== profile.slug) {
      const { data: available, error: slugError } = await supabase.rpc('slug_disponivel', {
        p_slug: values.slug,
      });
      if (slugError) throw slugError;
      if (!available) throw new Error('Este link já está em uso. Escolha outro nome para o seu link.');
    }
    const { error } = await supabase.from(table).update(updateValues).eq('id', user.id);
    if (error) throw error;
    setProfile((current) => ({ ...current, ...updateValues }));
  }

  async function deleteAccount() {
    const functionName = role === 'professora'
      ? 'excluir_minha_conta_professora'
      : 'excluir_minha_conta_aluno';
    const { error } = await supabase.rpc(functionName);
    if (error) throw error;
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
    setProfile(null);
    setRole(null);
    setView('home');
  }

  async function saveLeadTime(hours) {
    const { error } = await supabase.from('perfis')
      .update({ antecedencia_cancelamento_horas: hours })
      .eq('id', user.id);
    if (error) throw error;
    setProfile((current) => ({ ...current, antecedencia_cancelamento_horas: hours }));
  }

  async function saveLesson(value) {
    const values = {
      nome: value.nome,
      duracao_min: value.duracao,
      preco: value.preco.toFixed(2),
      ativo: true,
    };
    const result = value.id
      ? await supabase.from('aulas').update(values).eq('id', value.id).eq('professora_id', user.id)
      : await supabase.from('aulas').insert({ ...values, professora_id: user.id });
    if (result.error) throw result.error;
    setNotice(value.id ? 'Aula atualizada.' : 'Aula cadastrada.');
    setView('teacher');
  }

  function requireAuth(selection) {
    if (user && role === 'aluno') {
      setView('student');
      return;
    }
    if (user && role === 'professora') {
      setView('teacher');
      return;
    }
    if (selection) {
      const url = new URL(window.location.href);
      url.searchParams.set('professora', publicSlugFromLocation());
      [['aula', selection.aulaId], ['data', selection.date], ['inicio', selection.inicio]]
        .forEach(([key, value]) => {
          if (value) url.searchParams.set(key, value);
          else url.searchParams.delete(key);
        });
      window.history.replaceState(null, '', url);
    }
    setAuthRole('aluno');
    setAuthMode('login');
    setView('auth');
  }

  function openAuth(nextRole, mode) {
    setAuthRole(nextRole);
    setAuthMode(mode);
    if (nextRole === 'professora' && !slugManuallyEdited) setSlug(slugify(name));
    setAuthMessage('');
    setAuthError('');
    setView('auth');
  }

  function chooseAuthRole(nextRole) {
    setAuthRole(nextRole);
    if (nextRole === 'professora' && !slugManuallyEdited) setSlug(slugify(name));
  }

  if (authStatus === STATUS.LOADING) return <LoadingState label="Verificando sua sessão" />;
  if (authStatus === STATUS.ERROR) {
    return <main className="mx-auto max-w-xl p-5"><ErrorState message={authError || 'Não foi possível verificar sua sessão.'} onRetry={() => window.location.reload()} /></main>;
  }
  if (view === 'error') {
    return <main className="mx-auto max-w-xl p-5"><ErrorState message={authError || 'Não foi possível abrir o painel.'} onRetry={() => window.location.reload()} /></main>;
  }
  if (view === 'teacher' && profile && role === 'professora') {
    return (
      <TeacherLessonsPage
        profile={profile}
        notice={notice}
        onLogout={logout}
        onEditProfile={() => setView('profile')}
        onAddLesson={() => { setEditingLesson(null); setView('lesson-form'); }}
        onEditLesson={(lesson) => { setEditingLesson(lesson); setView('lesson-form'); }}
        onOpenAvailability={() => setView('availability')}
        onOpenAgenda={() => setView('agenda')}
        onSaveLeadTime={saveLeadTime}
      />
    );
  }
  if (view === 'student' && profile && role === 'aluno') {
    return <StudentDashboardPage onEditProfile={() => setView('profile')} onLogout={logout} />;
  }
  if (view === 'profile' && profile && role) {
    return (
      <ProfilePage
        role={role}
        profile={profile}
        user={user}
        onBack={() => setView(role === 'professora' ? 'teacher' : 'student')}
        onSave={saveProfile}
        onDelete={deleteAccount}
      />
    );
  }
  if (view === 'lesson-form' && user && role === 'professora') {
    return <TeacherLessonFormPage lesson={editingLesson || undefined} onSave={saveLesson} onCancel={() => setView('teacher')} />;
  }
  if (view === 'availability' && profile && role === 'professora') {
    return <TeacherAvailabilityPage profile={profile} onBack={() => setView('teacher')} />;
  }
  if (view === 'agenda' && profile && role === 'professora') {
    return <TeacherDailyAgendaPage profile={profile} onBack={() => setView('teacher')} />;
  }
  if (view === 'public') {
    return <StudentBookingPage role={role} user={user} onRequireAuth={requireAuth} />;
  }
  if (view === 'student-consent') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-8">
        <Card>
          <h1 className="text-2xl font-bold">Consentimento para uso dos dados</h1>
          <p className="mt-3 text-sm text-muted">Usaremos seu nome e contato para identificar sua conta e administrar seus agendamentos, conforme a política de privacidade.</p>
          <label className="mt-5 flex items-start gap-3 text-sm text-muted">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={studentConsent} onChange={(event) => setStudentConsent(event.target.checked)} />
            <span>Li e aceito o uso dos meus dados para gerenciar meus agendamentos (versão agendamento-v1).</span>
          </label>
          {authError && <p className="mt-3 text-sm text-danger" role="alert">{authError}</p>}
          <Button className="mt-5 w-full" loading={formBusy} onClick={finishStudentConsent}>Continuar para minha conta</Button>
          <Button className="mt-2 w-full" variant="ghost" onClick={logout}>Sair</Button>
        </Card>
      </main>
    );
  }
  if (view === 'password-reset') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-8">
        <Card>
          <h1 className="text-2xl font-bold">Definir nova senha</h1>
          <form className="mt-5 space-y-4" onSubmit={saveNewPassword}>
            <Input label="Nova senha" name="new-password" type="password" value={newPassword} onChange={setNewPassword} required autoComplete="new-password" />
            <Input label="Confirmar nova senha" name="new-password-confirmation" type="password" value={newPasswordConfirmation} onChange={setNewPasswordConfirmation} required autoComplete="new-password" />
            {authError && <p className="text-sm text-danger" role="alert">{authError}</p>}
            {authMessage && <p className="text-sm text-success" role="status">{authMessage}</p>}
            <Button type="submit" className="w-full" loading={formBusy}>Salvar nova senha</Button>
          </form>
        </Card>
      </main>
    );
  }

  const hasPublicSlug = Boolean(publicSlugFromLocation());
  const authHeading = authMode === 'signup'
    ? 'Criar conta'
    : authMode === 'recovery'
      ? 'Recuperar senha'
      : 'Entrar';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-3xl bg-gradient-to-br from-primary to-accent p-6 text-white shadow-lg sm:p-10">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest">EnglishFlow</span>
        <h1 className="mt-5 max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">Agende e gerencie aulas de inglês com facilidade.</h1>
        <p className="mt-3 max-w-lg text-sm text-white/90 sm:text-base">Uma experiência simples, pensada para funcionar bem no celular.</p>
      </header>

      {view === 'auth' ? (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">{authRole === 'professora' ? 'Professora' : 'Aluno'}</p>
              <h2 className="mt-1 text-2xl font-bold">{authHeading}</h2>
            </div>
            <Button variant="ghost" onClick={() => setView(hasPublicSlug ? 'public' : 'home')}>Voltar</Button>
          </div>
          {authMode !== 'recovery' && (
            <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Ação da conta">
              <Button
                role="tab"
                aria-selected={authMode === 'login'}
                variant={authMode === 'login' ? 'primary' : 'secondary'}
                onClick={() => { setAuthMode('login'); setAuthMessage(''); setAuthError(''); }}
              >
                Entrar
              </Button>
              <Button
                role="tab"
                aria-selected={authMode === 'signup'}
                variant={authMode === 'signup' ? 'primary' : 'secondary'}
                onClick={() => { setAuthMode('signup'); setAuthMessage(''); setAuthError(''); }}
              >
                Criar conta
              </Button>
            </div>
          )}
          {authMode !== 'recovery' && (
            <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Tipo de conta">
              {['professora', 'aluno'].map((option) => (
                <Button
                  key={option}
                  variant={authRole === option ? 'primary' : 'secondary'}
                  aria-pressed={authRole === option}
                  onClick={() => chooseAuthRole(option)}
                >
                  {option === 'professora' ? 'Professora' : 'Aluno'}
                </Button>
              ))}
            </div>
          )}
          <form className="mt-5 space-y-4" onSubmit={submitAuth}>
            {authMode === 'signup' && (
              <>
                <Input label="Nome" name="nome" value={name} onChange={(value) => {
                  setName(value);
                  if (authRole === 'professora' && !slugManuallyEdited) setSlug(slugify(value));
                }} required autoComplete="name" />
                <Input label="Telefone (opcional)" name="telefone" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
                {authRole === 'professora' && (
                  <Input
                    label="Link público desejado"
                    name="slug"
                    value={slug}
                    onChange={(value) => { setSlug(value); setSlugManuallyEdited(true); }}
                    required
                    hint="Use letras minúsculas, números e hífens."
                  />
                )}
                {authRole === 'professora' && slugStatus.message && (
                  <p className={`-mt-3 text-sm ${slugStatus.state === 'available' ? 'text-success' : slugStatus.state === 'unavailable' || slugStatus.state === 'error' ? 'text-danger' : 'text-muted'}`} role="status" aria-live="polite">
                    {slugStatus.message}
                  </p>
                )}
                {authRole === 'aluno' && (
                  <label className="flex items-start gap-3 text-sm text-muted">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={studentConsent} onChange={(event) => setStudentConsent(event.target.checked)} />
                    <span>Aceito o uso dos meus dados para identificar minha conta e administrar meus agendamentos (versão agendamento-v1).</span>
                  </label>
                )}
              </>
            )}
            <Input label="E-mail" name="email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
            {authMode !== 'recovery' && (
              <Input label="Senha" name="password" type="password" value={password} onChange={setPassword} required autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} />
            )}
            {authError && <p className="text-sm text-danger" role="alert" aria-live="assertive">{authError}</p>}
            {authMessage && <p className="text-sm text-success" role="status" aria-live="polite">{authMessage}</p>}
            <Button type="submit" loading={formBusy} className="w-full">
              {authMode === 'signup' ? 'Criar conta' : authMode === 'recovery' ? 'Enviar instruções' : 'Entrar'}
            </Button>
          </form>
          {authMode === 'login' && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => { setAuthMode('recovery'); setAuthMessage(''); }}>
              Esqueci minha senha
            </Button>
          )}
          {authMode === 'recovery' && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => { setAuthMode('login'); setAuthMessage(''); setAuthError(''); }}>
              Voltar para entrar
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Professora</p>
            <h2 className="mt-2 text-xl font-bold">Registrar aulas e agenda</h2>
            <Button className="mt-5 w-full" onClick={() => openAuth('professora', 'login')}>Acesso da professora</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => openAuth('professora', 'signup')}>Criar conta de professora</Button>
          </Card>
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">Aluno</p>
            <h2 className="mt-2 text-xl font-bold">Contratar e acompanhar aulas</h2>
            {hasPublicSlug ? (
              <Button className="mt-5 w-full" onClick={() => setView('public')}>Voltar ao agendamento</Button>
            ) : (
              <p className="mt-2 text-sm text-muted">Abra o link público compartilhado pela professora para contratar uma aula.</p>
            )}
            <Button variant="secondary" className="mt-3 w-full" onClick={() => openAuth('aluno', 'login')}>Entrar como aluno</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => openAuth('aluno', 'signup')}>Criar conta de aluno</Button>
          </Card>
        </div>
      )}
    </main>
  );
}
