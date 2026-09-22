'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AnnouncementKind } from '@/lib/types';

const KINDS: { value: AnnouncementKind; label: string; hint: string }[] = [
  { value: 'INFO', label: 'Мэдээлэл', hint: 'ерөнхий мэдээ' },
  { value: 'URGENT', label: 'Яаралтай', hint: 'тасалдал, аваар' },
  { value: 'MAINTENANCE', label: 'Засвар', hint: 'хуваарьт ажил' },
];

/** Шинэ зарлал бичих форм */
export function AnnouncementForm() {
  const router = useRouter();
  const [kind, setKind] = useState<AnnouncementKind>('INFO');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        title,
        body,
        isPinned,
        // <input type="date"> нь "2026-09-25" буцаана — өдрийн ТӨГСГӨЛ болгоно
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      }),
    });

    const result = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(result.error ?? 'Хадгалахад алдаа гарлаа');
      return;
    }

    setTitle('');
    setBody('');
    setIsPinned(false);
    setExpiresAt('');
    setKind('INFO');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-semibold text-slate-900">Шинэ зарлал</h2>

      <div className="mb-4">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Төрөл</span>
        <div className="flex gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              aria-pressed={kind === k.value}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                kind === k.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {k.label}
              <span className="mt-0.5 block text-[10px] font-normal opacity-70">{k.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="ann-title" className="mb-1.5 block text-sm font-medium text-slate-700">
          Гарчиг
        </label>
        <input
          id="ann-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Халуун усны тасалдал"
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="ann-body" className="mb-1.5 block text-sm font-medium text-slate-700">
          Агуулга
        </label>
        <textarea
          id="ann-body"
          required
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Маргааш 10:00–16:00 хооронд халуун ус тасарна."
          className="w-full resize-y rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
        />
        <p className="mt-1 text-xs text-slate-400">Мөр шинээр бичсэн нь дэлгэц дээр хэвээр харагдана.</p>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ann-expires" className="mb-1.5 block text-sm font-medium text-slate-700">
            Хүчинтэй хугацаа
          </label>
          <input
            id="ann-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
          />
          <p className="mt-1 text-xs text-slate-400">Хоосон бол хугацаагүй</p>
        </div>

        <label className="flex items-start gap-2.5 pt-7 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            Онцлох
            <span className="block text-xs text-slate-400">Бусад зарлалын дээр тогтмол гарна</span>
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {busy ? 'Хадгалж байна…' : 'Нийтлэх'}
      </button>
    </form>
  );
}
