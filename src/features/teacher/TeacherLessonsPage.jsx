import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../supabase.js';
import { AulaList } from '../../components/AulaList.jsx';
import { Button } from '../../components/Button.jsx';
import { Card } from '../../components/Card.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { LoadingState } from '../../components/LoadingState.jsx';
import { getSupabaseErrorMessage, STATUS } from '../../lib/status.js';

/**
 * @param {{ profile: {id: string, nome: string, slug: string, antecedencia_cancelamento_horas: number}, notice?: string, onLogout: () => void, onEditProfile: () => void, onAddLesson: () => void, onEditLesson: (lesson: object) => void, onOpenAvailability: () => void, onOpenAgenda: () => void, onSaveLeadTime: (hours: number) => Promise<void> }} props
 */
export function TeacherLessonsPage({
  profile,
  notice,
  onLogout,
  onEditProfile,
  onAddLesson,
  onEditLesson,
  onOpenAvailability,
  onOpenAgenda,
  onSaveLeadTime,
}) {
  const [lessons, setLessons] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [errorMessage, setErrorMessage] = useState('');
  const [leadTime, setLeadTime] = useState(String(profile.antecedencia_cancelamento_horas ?? 12));
  const [savingLeadTime, setSavingLeadTime] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const loadLessons = useCallback(async () => {
    setStatus(STATUS.LOADING);
    setErrorMessage('');
    const { data, error } = await supabase
      .from('aulas')
      .select('id,nome,duracao_min,preco,ativo')
      .eq('professora_id', profile.id)
      .order('nome');
    if (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
      return;
    }
    setLessons(data || []);
    setStatus(data?.length ? STATUS.SUCCESS : STATUS.EMPTY);
  }, [profile.id]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  async function deleteLesson(lesson) {
    if (!window.confirm(`Excluir a aula “${lesson.nome}”? Aulas com agendamentos não podem ser excluídas.`)) return;
    const { error } = await supabase.from('aulas')
      .delete()
      .eq('id', lesson.id)
      .eq('professora_id', profile.id);
    if (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
      return;
    }
    await loadLessons();
  }

  async function copyBookingLink() {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('professora', profile.slug);
    try {
      await navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setErrorMessage('Não foi possível copiar o link. Copie o endereço da barra do navegador.');
      setStatus(STATUS.ERROR);
    }
  }

  async function saveLeadTime(event) {
    event.preventDefault();
    const hours = Number(leadTime);
    if (!Number.isInteger(hours) || hours < 0 || hours > 72) {
      setErrorMessage('Informe um número inteiro entre 0 e 72 horas.');
      setStatus(STATUS.ERROR);
      return;
    }
    setSavingLeadTime(true);
    try {
      await onSaveLeadTime(hours);
      setErrorMessage('');
      setStatus(lessons.length ? STATUS.SUCCESS : STATUS.EMPTY);
    } catch (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
    } finally {
      setSavingLeadTime(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Painel da professora</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{profile.nome}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onEditProfile}>Meu perfil</Button>
          <Button variant="ghost" onClick={onLogout}>Sair</Button>
        </div>
      </header>

      <nav className="grid gap-3 sm:grid-cols-3" aria-label="Ações do painel">
        <Button variant="secondary" onClick={copyBookingLink}>{linkCopied ? 'Link copiado!' : 'Copiar link de agendamento'}</Button>
        <Button variant="secondary" onClick={onOpenAvailability}>Disponibilidade e bloqueios</Button>
        <Button variant="secondary" onClick={onOpenAgenda}>Agenda do dia</Button>
      </nav>

      <Card>
        {notice && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status" aria-live="polite">{notice}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Aulas oferecidas</h2>
            <p className="mt-1 text-sm text-muted">Cadastre os tipos de aula que seus alunos podem agendar.</p>
          </div>
          <Button onClick={onAddLesson}>+ Nova aula</Button>
        </div>

        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={saveLeadTime}>
          <label className="flex-1 text-sm font-medium">
            Antecedência para alterações (horas)
            <input
              type="number"
              min="0"
              max="72"
              step="1"
              value={leadTime}
              onChange={(event) => setLeadTime(event.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base"
              required
            />
          </label>
          <Button type="submit" loading={savingLeadTime} variant="secondary">Salvar prazo</Button>
        </form>

        {status === STATUS.LOADING && <div className="mt-6"><LoadingState label="Carregando aulas" /></div>}
        {status === STATUS.ERROR && (
          <div className="mt-6">
            <ErrorState message={errorMessage} onRetry={loadLessons} />
          </div>
        )}
        {status === STATUS.EMPTY && (
          <div className="mt-6">
            <EmptyState title="Nenhuma aula cadastrada" description="Cadastre sua primeira aula para começar a receber agendamentos." actionLabel="+ Nova aula" onAction={onAddLesson} />
          </div>
        )}
        {status === STATUS.SUCCESS && (
          <div className="mt-6">
            <AulaList lessons={lessons} onCreate={onAddLesson} onEdit={onEditLesson} onDelete={deleteLesson} />
          </div>
        )}
      </Card>
    </main>
  );
}
