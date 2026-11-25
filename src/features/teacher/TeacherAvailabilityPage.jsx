import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../supabase.js';
import { Button } from '../../components/Button.jsx';
import { Card } from '../../components/Card.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ErrorState } from '../../components/ErrorState.jsx';
import { Input } from '../../components/Input.jsx';
import { LoadingState } from '../../components/LoadingState.jsx';
import { formatLocalDate, todayInSaoPaulo } from '../../lib/dates.js';
import { getSupabaseErrorMessage, STATUS } from '../../lib/status.js';

const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

/**
 * @param {{ profile: {id: string, nome: string}, onBack: () => void }} props
 */
export function TeacherAvailabilityPage({ profile, onBack }) {
  const [availability, setAvailability] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [errorMessage, setErrorMessage] = useState('');
  const [weekday, setWeekday] = useState('1');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('12:00');
  const [blockDate, setBlockDate] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    setStatus(STATUS.LOADING);
    setErrorMessage('');
    const [availabilityResult, blocksResult] = await Promise.all([
      supabase.from('disponibilidades')
        .select('id,dia_semana,hora_inicio,hora_fim')
        .eq('professora_id', profile.id)
        .order('dia_semana')
        .order('hora_inicio'),
      supabase.from('bloqueios')
        .select('id,data,motivo')
        .eq('professora_id', profile.id)
        .gte('data', todayInSaoPaulo())
        .order('data'),
    ]);
    const error = availabilityResult.error || blocksResult.error;
    if (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
      return;
    }
    setAvailability(availabilityResult.data || []);
    setBlocks(blocksResult.data || []);
    setStatus(STATUS.SUCCESS);
  }, [profile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function addAvailability(event) {
    event.preventDefault();
    const day = Number(weekday);
    if (!Number.isInteger(day) || day < 0 || day > 6 || !start || !end || start >= end) {
      setErrorMessage('Escolha o dia e informe um horário final posterior ao inicial.');
      setStatus(STATUS.ERROR);
      return;
    }
    if (availability.some((item) => item.dia_semana === day && start < item.hora_fim && item.hora_inicio < end)) {
      setErrorMessage('Esta faixa se sobrepõe a outra disponibilidade do mesmo dia.');
      setStatus(STATUS.ERROR);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('disponibilidades').insert({
      professora_id: profile.id,
      dia_semana: day,
      hora_inicio: start,
      hora_fim: end,
    });
    if (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
    } else {
      setErrorMessage('');
      await loadData();
    }
    setBusy(false);
  }

  async function addBlock(event) {
    event.preventDefault();
    if (!blockDate || blockDate < todayInSaoPaulo()) {
      setErrorMessage('Escolha uma data de hoje em diante.');
      setStatus(STATUS.ERROR);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('bloqueios').insert({
      professora_id: profile.id,
      data: blockDate,
      motivo: blockReason.trim() || null,
    });
    if (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
    } else {
      setBlockDate('');
      setBlockReason('');
      setErrorMessage('');
      await loadData();
    }
    setBusy(false);
  }

  async function removeRow(table, id) {
    setBusy(true);
    const { error } = await supabase.from(table)
      .delete()
      .eq('id', id)
      .eq('professora_id', profile.id);
    if (error) {
      setErrorMessage(getSupabaseErrorMessage(error));
      setStatus(STATUS.ERROR);
    } else {
      setErrorMessage('');
      await loadData();
    }
    setBusy(false);
  }

  if (status === STATUS.LOADING) {
    return <main className="mx-auto max-w-4xl p-4 sm:p-6"><LoadingState label="Carregando disponibilidade" /></main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex items-center gap-3">
        <Button data-testid="nav-painel" variant="secondary" onClick={onBack}>Voltar</Button>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{profile.nome}</p>
          <h1 className="text-2xl font-bold">Disponibilidade e bloqueios</h1>
        </div>
      </header>
      {status === STATUS.ERROR && <div data-testid="erro-disponibilidade"><ErrorState message={errorMessage} onRetry={loadData} /></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold">Disponibilidade semanal</h2>
          <p className="mt-1 text-sm text-muted">Defina os períodos disponíveis para agendamento.</p>
          <form onSubmit={addAvailability} className="mt-4 space-y-4">
            <Input label="Dia da semana" name="weekday" type="select" testId="disp-dia" value={weekday} onChange={setWeekday} options={WEEKDAYS} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="A partir de" name="start" type="time" testId="disp-inicio" value={start} onChange={setStart} required />
              <Input label="Até" name="end" type="time" testId="disp-fim" value={end} onChange={setEnd} required />
            </div>
            <Button data-testid="disp-adicionar" type="submit" loading={busy} className="w-full">Adicionar faixa</Button>
          </form>
          <div className="mt-5 space-y-2">
            {availability.length ? availability.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <span className="text-sm font-medium">{WEEKDAYS.find((day) => day.value === item.dia_semana)?.label} · {item.hora_inicio.slice(0, 5)}–{item.hora_fim.slice(0, 5)}</span>
                <Button variant="danger" onClick={() => removeRow('disponibilidades', item.id)}>Remover</Button>
              </div>
            )) : <EmptyState title="Sem faixas cadastradas" description="Adicione seus horários semanais para que apareçam no catálogo de aulas." />}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold">Bloquear uma data</h2>
          <p className="mt-1 text-sm text-muted">O bloqueio impede novas reservas, sem cancelar aulas já marcadas.</p>
          <form onSubmit={addBlock} className="mt-4 space-y-4">
            <Input label="Data" name="data" type="date" testId="bloq-data" value={blockDate} onChange={setBlockDate} min={todayInSaoPaulo()} required />
            <Input label="Motivo (opcional)" name="motivo" value={blockReason} onChange={setBlockReason} />
            <Button data-testid="bloq-adicionar" type="submit" variant="secondary" loading={busy} className="w-full">Bloquear data</Button>
          </form>
          <div className="mt-5 space-y-2">
            {blocks.length ? blocks.map((block) => (
              <div key={block.id} data-testid="bloq-item" className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <span className="text-sm font-medium">{formatLocalDate(block.data, { dateStyle: 'long' })} · {block.motivo || 'Data bloqueada'}</span>
                <Button variant="danger" onClick={() => removeRow('bloqueios', block.id)}>Remover</Button>
              </div>
            )) : <EmptyState title="Sem datas bloqueadas" description="Se houver um dia em que não pode dar aula, bloqueie-o aqui." />}
          </div>
        </Card>
      </div>
    </main>
  );
}
