'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Хайлтын талбар — томруулагчтай, Enter эсвэл «Шүүх»-ээр ажиллана.
 *
 * ЯАГААД ТУСАД НЬ: сегмент товч ба сарын сум нь дарахад ШУУД шүүдэг.
 * Хайлт бол бичиж дуусахыг хүлээх ёстой тул Enter шаардана. Хоёуланг
 * нэг form-д хийвэл сонголт дарах бүрт хайлт алга болно.
 *
 * Бусад шүүлтийг URL-аас аваад хэвээр хадгална.
 */
export function SearchBox({
  placeholder = 'Тоот эсвэл эзний нэр',
  initial = '',
}: {
  placeholder?: string;
  initial?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    const trimmed = value.trim();
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');
    router.push(`?${next.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-64 rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none transition focus:border-slate-900"
        />
      </div>

      <button
        type="submit"
        className="h-9 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Шүүх
      </button>

      {initial && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            const next = new URLSearchParams(params.toString());
            next.delete('q');
            router.push(`?${next.toString()}`);
          }}
          className="h-9 px-1 text-sm text-slate-400 underline decoration-slate-300 transition hover:text-slate-700"
        >
          Цуцлах
        </button>
      )}
    </form>
  );
}
