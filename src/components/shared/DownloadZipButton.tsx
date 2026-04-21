'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ZipItem {
  filename: string;
  // Accepts both /api/history/{id}/image paths and data: URIs
  imageSrc: string;
}

interface Props {
  items: ZipItem[];
  zipName: string;
  disabled?: boolean;
}

async function srcToBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  return res.blob();
}

// ui-ux-pro-max: loading state during async ZIP generation, btn-secondary style
export function DownloadZipButton({ items, zipName, disabled }: Props) {
  const [building, setBuilding] = useState(false);

  if (items.length === 0) return null;

  const handleClick = async () => {
    if (building) return;
    setBuilding(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const item of items) {
        const blob = await srcToBlob(item.imageSrc);
        zip.file(item.filename, blob);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || building}
      aria-busy={building}
      className="btn-secondary"
    >
      {building ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="w-4 h-4" aria-hidden="true" />
      )}
      {building ? 'Building ZIP…' : `Download all (${items.length})`}
    </button>
  );
}
