'use client';

import { Loader2 } from 'lucide-react';

interface ProgressStepperProps {
  message: string;
  step: number;
  totalSteps: number;
}

/**
 * ProgressStepper — shows current step message and progress bar.
 * ui-ux-pro-max: loading-states (skeleton/spinner), aria-live for screen readers
 */
export function ProgressStepper({ message, step, totalSteps }: ProgressStepperProps) {
  const pct = totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0;

  return (
    <div
      className="rounded-xl p-5 space-y-3"
      style={{ background: 'var(--color-surface-container)' }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Progress: ${message}, step ${step} of ${totalSteps}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2
            className="w-4 h-4 animate-spin shrink-0"
            aria-hidden="true"
            style={{ color: 'var(--color-primary-cta)' }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>
            {message}
          </span>
        </div>
        <span className="label-meta">
          Stage {step} / {totalSteps}
        </span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
