'use client';

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
}

// ui-ux-pro-max: visible count with over-limit warning (error-placement near field)
export function BulkInput({ id, value, onChange, placeholder, max = 10, disabled }: Props) {
  const lines = value.split('\n').filter((l) => l.trim().length > 0);
  const overLimit = lines.length > max;

  return (
    <div className="space-y-1">
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder={placeholder ?? `One entry per line, max ${max}`}
        disabled={disabled}
        className="input-regulatory w-full font-mono"
        style={{ resize: 'vertical', borderRadius: '0.5rem 0.5rem 0 0' }}
      />
      <p
        className="label-meta"
        style={{ color: overLimit ? 'var(--color-error)' : undefined }}
        role={overLimit ? 'alert' : undefined}
      >
        {lines.length} / {max}
        {overLimit && ' — entries beyond the limit will be ignored'}
      </p>
    </div>
  );
}
