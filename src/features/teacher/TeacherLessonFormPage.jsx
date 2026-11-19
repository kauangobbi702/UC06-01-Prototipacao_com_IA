import { useState } from 'react';
import { AulaForm } from '../../components/AulaForm.jsx';
import { Button } from '../../components/Button.jsx';
import { Card } from '../../components/Card.jsx';
import { getSupabaseErrorMessage, STATUS } from '../../lib/status.js';

/**
 * @param {{ lesson?: {id: string, nome: string, duracao_min: number, preco: number}, onSave: (value: object) => Promise<void>, onCancel: () => void }} props
 */
export function TeacherLessonFormPage({ lesson, onSave, onCancel }) {
  const [status, setStatus] = useState(STATUS.SUCCESS);
  const [errorMessage, setErrorMessage] = useState('');

  async function submit(value) {
    setStatus(STATUS.LOADING);
    setErrorMessage('');
    try {
      await onSave(value);
      setStatus(STATUS.SUCCESS);
    } catch (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Aulas oferecidas</p>
          <h1 className="mt-1 text-2xl font-bold">{lesson ? 'Editar aula' : 'Nova aula'}</h1>
        </div>
        <Button variant="secondary" onClick={onCancel}>Voltar</Button>
      </header>
      <Card>
        {status === STATUS.ERROR && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-danger" role="alert" aria-live="assertive">
            {errorMessage}
          </p>
        )}
        {status === STATUS.SUCCESS && (
          <p className="sr-only" role="status" aria-live="polite">
            {lesson ? 'Edite os dados e salve as alterações.' : 'Preencha os campos para cadastrar uma aula.'}
          </p>
        )}
        <AulaForm
          key={lesson?.id || 'new-lesson'}
          initialValue={lesson}
          onSubmit={submit}
          onCancel={onCancel}
          submitting={status === STATUS.LOADING}
        />
      </Card>
    </main>
  );
}
