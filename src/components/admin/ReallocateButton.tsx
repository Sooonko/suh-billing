'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMnt } from '@/lib/format';

interface Result {
  allocated: number;
  skipped: number;
  missingFlats?: number[];
  totalAmount: number;
}

/**
 * Тоот нь танигдсан атлаа хуваарилагдаагүй гацсан гүйлгээг цэгцлэх товч.
 *
 * Зөвхөн ийм гүйлгээ БАЙГАА үед л харагдана — өдөр тутам хэрэглэх зүйл биш.
 */
export function ReallocateButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (count === 0 && !result) return null;

  async function run() {
    if (!confirm(`${count} гүйлгээг таасан тоот руу нь автоматаар хуваарилах уу?`)) return;
    setBusy(true);
    setError(null);

    const response = await fetch('/api/admin/reconcile/reallocate', { method: 'POST' });
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
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      {result ? (
        <p className="text-sm text-amber-900">
          ✓ <span className="font-semibold">{result.allocated}</span> гүйлгээ хуваарилагдлаа (
          {formatMnt(result.totalAmount)}).
          {result.skipped > 0 && (
            <>
              {' '}
              <span className="font-semibold">{result.skipped}</span> тоот flats хүснэгтэд байхгүй тул
              орхив
              {result.missingFlats?.length ? ` (${result.missingFlats.join(', ')})` : ''}.
            </>
          )}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-amber-900">
            <span className="font-semibold">{count}</span> гүйлгээний тоот танигдсан хэрнээ
            хуваарилагдаагүй байна. Файлыг дахин оруулах нь туслахгүй — давхардсан гэж алгасна.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? 'Хуваарилж байна…' : 'Автомат хуваарилалтыг дахин ажиллуулах'}
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
