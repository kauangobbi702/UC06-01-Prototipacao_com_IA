import { useState } from 'react';
import { Button } from './components/Button.jsx';
import { Card } from './components/Card.jsx';
import { ErrorState } from './components/ErrorState.jsx';
import { useAppContext } from './context/AppContext.jsx';
import { STATUS } from './lib/status.js';

export function App() {
  const { authStatus, authError } = useAppContext();
  const [selectedRole, setSelectedRole] = useState('');

  if (authStatus === STATUS.ERROR) return <ErrorState message={authError} onRetry={() => window.location.reload()} />;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-3xl bg-gradient-to-br from-primary to-accent p-6 text-white shadow-lg sm:p-10">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest">EnglishFlow</span>
        <h1 className="mt-5 max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">Agende e gerencie aulas de inglês com facilidade.</h1>
        <p className="mt-3 max-w-lg text-sm text-white/90 sm:text-base">Uma experiência simples, pensada para funcionar bem no celular.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Professora</p>
          <h2 className="mt-2 text-xl font-bold">Registrar aulas e agenda</h2>
          <p className="mt-2 text-sm text-muted">Cadastre aulas, horários disponíveis e acompanhe os agendamentos.</p>
          <Button className="mt-5 w-full" onClick={() => setSelectedRole('professora')}>Sou professora</Button>
        </Card>
        <Card>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Aluno</p>
          <h2 className="mt-2 text-xl font-bold">Contratar aulas</h2>
          <p className="mt-2 text-sm text-muted">Consulte os horários e gerencie suas próximas aulas.</p>
          <Button variant="secondary" className="mt-5 w-full" onClick={() => setSelectedRole('aluno')}>Sou aluno</Button>
        </Card>
      </div>
      {selectedRole && (
        <p className="rounded-xl bg-surface p-4 text-center text-sm text-muted" role="status">
          Acesso selecionado: {selectedRole}. A tela de autenticação será exibida nesta etapa da configuração.
        </p>
      )}
    </main>
  );
}
