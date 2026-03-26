'use client';

import { Loader2, Camera } from 'lucide-react';

interface CaptureButtonProps {
  isPending: boolean;
  disabled?: boolean;
  label?: string;
  onClick: () => void;
}

/**
 * CaptureButton — uses useTransition isPending for loading state.
 * ui-ux-pro-max: loading-buttons (disabled during async), touch-target (44px min)
 */
export function CaptureButton({
  isPending,
  disabled,
  label = 'Capture',
  onClick,
}: CaptureButtonProps) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={isPending || disabled}
      aria-busy={isPending}
      aria-label={isPending ? 'Capture in progress' : label}
      className="btn-primary shrink-0"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <Camera className="w-4 h-4" aria-hidden="true" />
      )}
      <span>{isPending ? 'Capturing…' : label}</span>
    </button>
  );
}
