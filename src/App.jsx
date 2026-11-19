import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { Button } from './components/Button.jsx';
import { Card } from './components/Card.jsx';
import { ErrorState } from './components/ErrorState.jsx';
import { Input } from './components/Input.jsx';
import { LoadingState } from './components/LoadingState.jsx';
import { useAppContext } from './context/AppContext.jsx';
import { TeacherLessonsPage } from './features/teacher/TeacherLessonsPage.jsx';
import { TeacherLessonFormPage } from './features/teacher/TeacherLessonFormPage.jsx';
import { TeacherAvailabilityPage } from './features/teacher/TeacherAvailabilityPage.jsx';
import { TeacherDailyAgendaPage } from './features/teacher/TeacherDailyAgendaPage.jsx';
import { StudentBookingPage } from './features/student/StudentBookingPage.jsx';
import { loadOrCreateTeacherProfile } from './services/teacherProfile.js';
import { getSupabaseErrorMessage, STATUS } from './lib/status.js';

function publicSlugFromLocation() {
  return new URLSearchParams(window.location.search).get('professora')?.trim().toLowerCase() || '';
}

export function App() {
  const {
    session,
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
  const [name, setName] = useState('Mariana Duarte');
  const [formBusy, setFormBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [editingLesson, setEditingLesson] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (authStatus === STATUS.LOADING || !session?.user) return;
    let active = true;
    loadOrCreateTeacherProfile(session.user)
      .then((teacherProfile) => {
        if (!active) return;
        setProfile(teacherProfile);
        setRole('professora');
        setView('teacher');
      })
      .catch(() => {
        if (!active) return;
        setAuthError('Não foi possível carregar o perfil da professora.');
        setView('error');
      });
    return () => {
      active = false;
    };
  }, [authStatus, session?.user?.id, setProfile, setRole, setAuthError]);

  async function submitAuth(event) {
    event.preventDefault();
    setFormBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { nome: name.trim() } } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (!result.data.session) {
        setAuthMessage('Conta criada. Confirme o e-mail e depois entre para continuar.');
        return;
      }
      await refreshSession();
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

  if (authStatus === STATUS.LOADING) return <LoadingState label="Verificando sua sessão" />;
  if (view === 'error') return <main className="mx-auto max-w-xl p-5"><ErrorState message={authError || 'Não foi possível abrir o painel.'} onRetry={() => window.location.reload()} /></main>;
  if (view === 'teacher' && profile) {
    return (
      <TeacherLessonsPage
        profile={profile}
        notice={notice}
        onLogout={logout}
        onAddLesson={() => { setEditingLesson(null); setView('lesson-form'); }}
        onEditLesson={(lesson) => { setEditingLesson(lesson); setView('lesson-form'); }}
        onOpenAvailability={() => setView('availability')}
        onOpenAgenda={() => setView('agenda')}
        onSaveLeadTime={saveLeadTime}
      />
    );
  }
  if (view === 'lesson-form' && user) {
    return (
      <TeacherLessonFormPage
        lesson={editingLesson || undefined}
        onSave={saveLesson}
        onCancel={() => setView('teacher')}
      />
    );
  }
  if (view === 'availability' && profile) {
    return <TeacherAvailabilityPage profile={profile} onBack={() => setView('teacher')} />;
  }
  if (view === 'agenda' && profile) {
    return <TeacherDailyAgendaPage profile={profile} onBack={() => setView('teacher')} />;
  }
  if (view === 'public') {
    return (
      <StudentBookingPage
        role={role}
        user={user}
        onRequireAuth={() => {
          setAuthRole('aluno');
          setAuthMode('login');
          setView('auth');
        }}
      />
    );
  }
  if (view === 'lesson-form' || view === 'availability' || view === 'agenda') {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <Card>
          <h1 className="text-xl font-bold">Próxima etapa</h1>
          <p className="mt-2 text-sm text-muted">Esta tela será habilitada na etapa correspondente.</p>
          <Button className="mt-5" onClick={() => setView('teacher')}>Voltar ao painel</Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-3xl bg-gradient-to-br from-primary to-accent p-6 text-white shadow-lg sm:p-10">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest">EnglishFlow</span>
        <h1 className="mt-5 max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">Agende e gerencie aulas de inglês com facilidade.</h1>
        <p className="mt-3 max-w-lg text-sm text-white/90 sm:text-base">Uma experiência simples, pensada para funcionar bem no celular.</p>
      </header>

      {view === 'home' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{authRole === 'professora' ? 'Professora' : 'Aluno'}</p>
            <h2 className="mt-2 text-xl font-bold">Registrar aulas e agenda</h2>
            <Button className="mt-5 w-full" onClick={() => { setAuthMode('login'); setView('auth'); }}>Acesso da professora</Button>
          </Card>
          <Card>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">Aluno</p>
            <h2 className="mt-2 text-xl font-bold">Contratar aulas</h2>
            <p className="mt-2 text-sm text-muted">Abra o link público compartilhado pela professora.</p>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Professora</p>
              <h2 className="mt-1 text-2xl font-bold">{authMode === 'signup' ? 'Criar conta' : 'Entrar'}</h2>
            </div>
            <Button variant="ghost" onClick={() => setView('home')}>Voltar</Button>
          </div>
          <form className="mt-5 space-y-4" onSubmit={submitAuth}>
            {authMode === 'signup' && <Input label="Nome" name="nome" value={name} onChange={setName} required autoComplete="name" />}
            <Input label="E-mail" name="email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
            <Input label="Senha" name="password" type="password" value={password} onChange={setPassword} required autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} />
            {authError && <p className="text-sm text-danger" role="alert" aria-live="assertive">{authError}</p>}
            {authMessage && <p className="text-sm text-success" role="status" aria-live="polite">{authMessage}</p>}
            <Button type="submit" loading={formBusy} className="w-full">{authMode === 'signup' ? 'Criar conta' : 'Entrar'}</Button>
          </form>
          <Button variant="ghost" className="mt-3 w-full" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthMessage(''); }}>
            {authMode === 'signup' ? 'Já tenho uma conta' : `Criar conta de ${authRole === 'professora' ? 'professora' : 'aluno'}`}
          </Button>
        </Card>
      )}
    </main>
  );
}
