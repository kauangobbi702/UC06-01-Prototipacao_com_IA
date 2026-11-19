import { useState } from 'react';
import { Button } from './Button.jsx';
import { Input } from './Input.jsx';
import { validateLesson } from '../lib/lessonValidation.js';

const EMPTY_FORM = { nome: '', duracao: '', precoCentavos: 0 };

/**
 * @param {{ initialValue?: {id?: string, nome?: string, duracao_min?: number, preco?: number}, onSubmit: (value: {id?: string, nome: string, duracao: number, preco: number}) => Promise<void>, onCancel?: () => void, submitting?: boolean }} props
 */
export function AulaForm({ initialValue, onSubmit, onCancel, submitting = false }) {
  const [values, setValues] = useState(() => initialValue
    ? {
      nome: initialValue.nome || '',
      duracao: String(initialValue.duracao_min || ''),
      precoCentavos: Math.round(Number(initialValue.preco || 0) * 100),
    }
    : EMPTY_FORM);
  const [errors, setErrors] = useState({});

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = validateLesson(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    await onSubmit({
      id: initialValue?.id,
      nome: values.nome.trim(),
      duracao: Number(values.duracao),
      preco: values.precoCentavos / 100,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Input label="Nome da aula" name="nome" value={values.nome} onChange={(value) => update('nome', value)} error={errors.nome} required placeholder="Ex.: Conversação individual" />
      <Input label="Duração (minutos)" name="duracao" type="number" value={values.duracao} onChange={(value) => update('duracao', value)} error={errors.duracao} required min={15} max={120} step={1} placeholder="50" />
      <Input label="Preço" name="preco" type="currency" value={values.precoCentavos} onChange={(value) => update('precoCentavos', value)} error={errors.preco} required />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" loading={submitting}>{initialValue?.id ? 'Salvar alterações' : 'Salvar aula'}</Button>
      </div>
    </form>
  );
}
