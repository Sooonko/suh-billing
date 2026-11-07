'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useFilterDraft } from './FilterDraft';

/**
 * Хайлтын талбар — томруулагчтай, Enter эсвэл «Шүүх»-ээр ажиллана.
 *
 * ЯАГААД ТУСАД НЬ: сегмент товч ба сарын сум нь дарахад ШУУД шүүдэг.
 * Хайлт бол бичиж дуусахыг хүлээх ёстой тул Enter шаардана. Хоёуланг
 * нэг form-д хийвэл сонголт дарах бүрт хайлт алга болно.
 *
 * Бусад шүүлтийг URL-аас аваад хэвээр хадгална.
 *
 * Шүүлтүүрийн картан дотор бол «Шүүх» нь Данс, Төлөв, Сар-ын ХҮЛЭЭЛГЭСЭН
 * сонголтыг хайлттай хамт НЭГ удаа хэрэгжүүлнэ (`FilterDraft`). Хэрэгжээгүй
 * сонголт байвал товч тодорч, «Шүүх» дарахыг сануулна.
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
  const draft = useFilterDraft();
  const [value, setValue] = useState(initial);
  // Хайх товч дарснаас хойш дата иртэл 1–2 секунд болдог
  const [ownPending, startTransition] = useTransition();
  const pending = ownPending || Boolean(draft?.pending);
  /** Хэрэгжээгүй сонголт эсвэл өөрчилсөн хайлт */
  const dirty = Boolean(draft?.dirty) || value.trim() !== initial;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft) {
      draft.apply({ q: value.trim() || null });
      return;
    }
    const next = new URLSearchParams(params.toString());
    // Шүүлт өөрчлөгдвөл 1-р хуудас руу — эс бөгөөс хэтэрсэн хуудас хоосон гарна
    next.delete('page');
    const trimmed = value.trim();
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');
    startTransition(() => router.push(`?${next.toString()}`));
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
        disabled={pending}
        className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-60 ${
          dirty && !pending
            ? 'bg-blue-600 ring-2 ring-blue-200 hover:bg-blue-700'
            : 'bg-slate-900 hover:bg-slate-800'
        }`}
      >
        {pending && (
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 animate-spin">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {pending ? 'Хайж байна…' : 'Шүүх'}
      </button>

      {initial && (
        <button
          type="button"
          onClick={() => {
            setValue('');
            if (draft) {
              draft.apply({ q: null });
              return;
            }
            const next = new URLSearchParams(params.toString());
            // Шүүлт өөрчлөгдвөл 1-р хуудас руу — эс бөгөөс хэтэрсэн хуудас хоосон гарна
            next.delete('page');
            next.delete('q');
            startTransition(() => router.push(`?${next.toString()}`));
          }}
          className="h-9 px-1 text-sm text-slate-400 underline decoration-slate-300 transition hover:text-slate-700"
        >
          Цуцлах
        </button>
      )}
    </form>
  );
}
