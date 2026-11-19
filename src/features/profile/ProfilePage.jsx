import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { Card } from '../../components/Card.jsx';
import { Input } from '../../components/Input.jsx';

/**
 * @param {{ role: string, profile: object, user: object, onBack: () => void, onSave: (values: object) => Promise<void>, onDelete: () => Promise<void> }} props
 */
export function ProfilePage({ role, profile, user, onBack, onSave, onDelete }) {
  const [name, setName] = useState(profile.nome || '');
  const [phone, setPhone] = useState(profile.telefone || '');
  const [slug, setSlug] = useState(profile.slug || '');
  const [leadTime, setLeadTime] = useState(String(profile.antecedencia_cancelamento_horas ?? 12));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isTeacher = role === 'professora';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onSave({
        nome: name.trim(),
        telefone: phone.trim() || null,
        slug: slug.trim().toLowerCase(),
        antecedencia_cancelamento_horas: Number(leadTime),
      });
      setNotice('Perfil atualizado.');
    } catch (saveError) {
      setError(saveError.message || 'Não foi possível salvar seu perfil.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    const message = isTeacher
      ? 'Excluir sua conta também removerá suas aulas, disponibilidades e agendamentos. Esta ação não pode ser desfeita.'
      : 'Excluir sua conta removerá seu perfil e seus agendamentos. Esta ação não pode ser desfeita.';
    if (!window.confirm(message)) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError.message || 'Não foi possível excluir sua conta.');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-5 px-4 py-8 sm:px-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Minha conta</p>
            <h1 className="mt-1 text-2xl font-bold">Editar perfil</h1>
          </div>
          <Button variant="ghost" onClick={onBack}>Voltar</Button>
        </div>
        <p className="mt-3 text-sm text-muted">Conta: {user.email}</p>
        {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
        {notice && <p className="mt-4 text-sm text-success" role="status">{notice}</p>}
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <Input label="Nome" name="nome" value={name} onChange={setName} required autoComplete="name" />
          {isTeacher && (
            <Input
              label="Link público (slug)"
              name="slug"
              value={slug}
              onChange={setSlug}
              required
              hint={`Link de agendamento: ${window.location.origin}/?professora=${slug}`}
            />
          )}
          {isTeacher && (
            <Input
              label="Antecedência para alterações (horas)"
              name="antecedencia_cancelamento_horas"
              type="number"
              value={leadTime}
              onChange={setLeadTime}
              min={0}
              max={72}
              step={1}
              required
              hint="Escolha um valor inteiro entre 0 e 72 horas."
            />
          )}
          <Input
            label="Telefone (opcional)"
            name="telefone"
            type="tel"
            value={phone}
            onChange={setPhone}
            autoComplete="tel"
          />
          <Button type="submit" className="w-full" loading={busy}>Salvar alterações</Button>
        </form>
        <div className="mt-8 border-t border-border pt-5">
          <h2 className="font-semibold text-danger">Excluir conta</h2>
          <p className="mt-1 text-sm text-muted">A exclusão remove os dados associados conforme a política de privacidade.</p>
          <Button variant="danger" className="mt-3 w-full" disabled={busy} onClick={deleteAccount}>Excluir minha conta</Button>
        </div>
      </Card>
    </main>
  );
}
