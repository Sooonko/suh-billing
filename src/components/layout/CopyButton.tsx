'use client';

import { useState } from 'react';

/**
 * Дансны дугаарыг хуулах товч.
 *
 * Гар утаснаас 10 оронтой дугаарыг гараар бичих нь андуурахад хялбар тул
 * хуулах товч тавьсан. Clipboard API боломжгүй тохиолдолд (хуучин хөтөч,
 * http холболт) товч дарагдсан ч чимээгүй өнгөрөхгүй — тайлбар гаргана.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'fail'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('done');
    } catch {
      setState('fail');
    }
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label} дансны дугаарыг хуулах`}
      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
    >
      {state === 'done' ? '✓ Хуулсан' : state === 'fail' ? 'Хуулж чадсангүй' : 'Хуулах'}
    </button>
  );
}
