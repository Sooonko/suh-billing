'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Result {
  checked: number;
  updated: number;
  stillUnknown: number;
}

/**
 * Тоот танихыг дахин ажиллуулах товч.
 *
 * Задлагч сайжрахад ХУУЧИН гүйлгээнүүд хуучин хариугаараа үлддэг —
 * `parsed_flat_number` нь мөрөнд хадгалагдсан байдаг. Файлыг дахин
 * оруулах нь туслахгүй (давхардсан гэж алгасна), тиймээс энэ товч
 * хэрэгтэй.
 *
 * Зөвхөн танигдаагүй гүйлгээ БАЙГАА үед харагдана. Хуваарилалт хийхгүй —
 * таьсны дараа доорх «Хуваарилах» товчоор мөнгийг оногдуулна.
 */
export function ReparseButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (count === 0 && !result) return null;

  async function run() {
    setBusy(true);
    setError(null);

    const response = await fetch('/api/admin/reconcile/reparse', { method: 'POST' });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? 'Алдаа гарлаа');
      return;
    }
    setResult(data as Result);
    router.refresh();
  }

  return (
    <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
      {result ? (
        <p className="text-sm text-sky-900">
          ✓ <span className="font-semibold">{result.checked}</span> гүйлгээг дахин уншиж,{' '}
          <span className="font-semibold">{result.updated}</span>-ийн тоотыг таньлаа.
          {result.stillUnknown > 0 && (
            <>
              {' '}
              <span className="font-semibold">{result.stillUnknown}</span> нь утгандаа тоот агуулаагүй
              тул гараар шийднэ.
            </>
          )}
          {result.updated > 0 && ' Одоо доорх «Хуваарилах» товчоор мөнгийг оногдуулна уу.'}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-sky-900">
            <span className="font-semibold">{count}</span> гүйлгээний тоот танигдаагүй байна. Тоот
            таних дүрэм сайжирсан бол дахин уншуулж үзээрэй — файлыг дахин оруулах нь туслахгүй
            (давхардсан гэж алгасна).
          </p>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-50"
          >
            {busy ? 'Уншиж байна…' : 'Тоотыг дахин таних'}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
