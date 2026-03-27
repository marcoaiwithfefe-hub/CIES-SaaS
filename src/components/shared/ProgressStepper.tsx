'use client';

import { useState, useEffect } from 'react';

interface ProgressStepperProps {
  /** Label shown for the current stage */
  message?: string;
  /** Manual step override (optional — if omitted, auto-cycles through stages) */
  step?: number;
  totalSteps?: number;
  /** Use auto-cycling stages tailored to the tool */
  tool?: 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';
}

const HKEX_STAGES = [
  { label: 'Launching secure browser…',   pct: 12 },
  { label: 'Navigating to HKEX portal…',  pct: 30 },
  { label: 'Searching stock code…',        pct: 55 },
  { label: 'Waiting for results…',         pct: 72 },
  { label: 'Capturing viewport…',          pct: 90 },
];

const SFC_STAGES = [
  { label: 'Launching secure browser…',        pct: 10 },
  { label: 'Loading SFC CIES register…',       pct: 28 },
  { label: 'Expanding fund table…',            pct: 48 },
  { label: 'Matching fund keywords…',          pct: 68 },
  { label: 'Capturing matching rows…',         pct: 86 },
];

const AFRC_STAGES = [
  { label: 'Launching secure browser…',        pct: 12 },
  { label: 'Loading AFRC CPA register…',       pct: 35 },
  { label: 'Searching CPA records…',           pct: 60 },
  { label: 'Capturing audit screenshot…',      pct: 85 },
];

function getStages(tool?: string) {
  if (tool === 'sfc') return SFC_STAGES;
  if (tool === 'afrc' || tool === 'afrc-firm') return AFRC_STAGES;
  return HKEX_STAGES;
}

/**
 * ProgressStepper — animated stage tracker for Playwright captures.
 *
 * When `tool` is set, auto-cycles through realistic stage labels on a timer.
 * When `step` / `totalSteps` are set manually, renders a static bar.
 *
 * ui-ux-pro-max: loading-states, aria-live, reduced-motion safe
 */
export function ProgressStepper({ message, step, totalSteps, tool }: ProgressStepperProps) {
  const stages = getStages(tool);

  // Auto-advance through stages for a realistic feel
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (!tool) return; // Manual mode — don't auto-advance
    setCurrentIdx(0);

    // Each stage lasts 3–5 s; last stage stays until done
    const timers: ReturnType<typeof setTimeout>[] = [];
    stages.forEach((_, i) => {
      if (i === 0) return;
      const delay = i * 4200; // ~4 s per stage
      timers.push(setTimeout(() => setCurrentIdx(i), delay));
    });
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  const isAuto = Boolean(tool);
  const activeStage = isAuto ? stages[currentIdx] : null;
  const displayMessage = activeStage?.label ?? message ?? 'Processing…';
  const pct = activeStage
    ? activeStage.pct
    : totalSteps && totalSteps > 0
    ? Math.round(((step ?? 1) / totalSteps) * 100)
    : 0;

  const stageLabel = isAuto
    ? `Stage ${currentIdx + 1} / ${stages.length}`
    : `Stage ${step ?? 1} / ${totalSteps ?? 1}`;

  return (
    <div
      className="rounded-xl p-5 space-y-3"
      style={{ background: 'var(--color-surface-container)' }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Progress: ${displayMessage}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Animated pulse dot — shows browser is actively working */}
          <div className="stage-dot" aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>
            {displayMessage}
          </span>
        </div>
        <span className="label-meta">{stageLabel}</span>
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

      {/* Stage dots row — visual hint of how far through the pipeline we are */}
      {isAuto && (
        <div className="flex gap-1.5 pt-1" aria-hidden="true">
          {stages.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 2,
                borderRadius: 999,
                background: i <= currentIdx
                  ? 'var(--color-primary-cta)'
                  : 'var(--color-surface-high)',
                transition: 'background 400ms ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
