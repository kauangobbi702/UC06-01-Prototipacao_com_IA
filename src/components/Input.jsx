import { useId } from 'react';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function currencyText(cents) {
  return cents > 0 ? currencyFormatter.format(cents / 100) : '';
}

/**
 * @param {{ label: string, name: string, type?: string, value: string|number, onChange: (value: string|number) => void, error?: string, hint?: string, options?: Array<{value: string|number, label: string}>, required?: boolean, min?: number, max?: number, step?: number, placeholder?: string, autoComplete?: string, disabled?: boolean, id?: string, className?: string }} props
 */
export function Input({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  options = [],
  required = false,
  min,
  max,
  step,
  placeholder,
  autoComplete,
  disabled = false,
  id: suppliedId,
  className = '',
}) {
  const generatedId = useId();
  const id = suppliedId || generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined;
  const sharedProps = {
    id,
    name,
    required,
    disabled,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
    className: `mt-1.5 min-h-11 w-full rounded-xl border bg-surface px-3 text-base text-text placeholder:text-muted focus:border-accent disabled:opacity-60 ${error ? 'border-danger' : 'border-border'} ${className}`,
  };

  let control;
  if (type === 'select') {
    control = (
      <select {...sharedProps} value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  } else if (type === 'currency') {
    control = (
      <input
        {...sharedProps}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder || 'R$ 0,00'}
        value={currencyText(Number(value || 0))}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 10);
          onChange(digits ? Number(digits) : 0);
        }}
      />
    );
  } else {
    control = (
      <input
        {...sharedProps}
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}{required && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {hint && <p id={hintId} className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p id={errorId} className="mt-1 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
