'use client';

type Lang = 'en' | 'tc';

interface Props {
  value: Lang;
  onChange: (lang: Lang) => void;
}

// ui-ux-pro-max: aria-pressed for toggle semantics, 44px min touch targets
export function LanguageToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex rounded-full p-0.5 text-sm"
      style={{
        background: 'var(--color-surface-high)',
        border: '1px solid color-mix(in srgb, var(--color-outline-var) 40%, transparent)',
      }}
    >
      {(['en', 'tc'] as const).map((lang) => {
        const active = value === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => onChange(lang)}
            aria-pressed={active}
            style={{
              minHeight: '36px',
              minWidth: '52px',
              background: active
                ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-cta) 100%)'
                : 'transparent',
              color: active ? 'var(--color-on-primary)' : 'var(--color-on-surface-var)',
              fontWeight: active ? 600 : 400,
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem 0.75rem',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >
            {lang === 'en' ? 'EN' : '中文'}
          </button>
        );
      })}
    </div>
  );
}
