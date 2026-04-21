'use client';

import { useState } from 'react';
import { Download, Copy, Maximize2 } from 'lucide-react';

interface Props {
  // Accepts both /api/history/{id}/image paths and data: URIs
  imageSrc: string;
  filename: string;
}

async function copyImageToClipboard(src: string): Promise<void> {
  const res = await fetch(src);
  const blob = await res.blob();
  if (!navigator.clipboard || !('write' in navigator.clipboard)) {
    throw new Error('Clipboard API not supported in this browser');
  }
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
}

// ui-ux-pro-max: copy state feedback within 1500ms, btn-ghost 44px touch targets
export function ScreenshotActions({ imageSrc, filename }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');

  const handleDownload = async () => {
    // For URL paths we must fetch → blob URL to trigger a real download with filename
    const res = await fetch(imageSrc);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await copyImageToClipboard(imageSrc);
      setCopyState('ok');
    } catch {
      setCopyState('err');
    }
    setTimeout(() => setCopyState('idle'), 1500);
  };

  const handleViewFull = () => window.open(imageSrc, '_blank', 'noopener');

  return (
    <div className="flex gap-2 flex-wrap">
      <button type="button" onClick={handleDownload} className="btn-ghost text-xs gap-1.5">
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        Download
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="btn-ghost text-xs gap-1.5"
        style={
          copyState === 'ok' ? { color: 'var(--color-primary)' }
          : copyState === 'err' ? { color: 'var(--color-error)' }
          : undefined
        }
      >
        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
        {copyState === 'ok' ? 'Copied!' : copyState === 'err' ? 'Unsupported' : 'Copy'}
      </button>
      <button type="button" onClick={handleViewFull} className="btn-ghost text-xs gap-1.5">
        <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
        Full size
      </button>
    </div>
  );
}
