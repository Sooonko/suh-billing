'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Тоот оруулах дэлгэц.
 *
 * Нууц үг шаардахгүй (СӨХ-ийн шийдвэр). Тиймээс энэ дэлгэцээс цаашхи бүх
 * хандалт сервер талаар шүүгдэнэ — тухайн тоотын дата л буцаана.
 */
export default function FlatLookupPage() {
  const router = useRouter();
  const [flatNumber, setFlatNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = flatNumber.trim();

    if (!/^\d{1,4}$/.test(value)) {
      setError('Тоотоо зөв оруулна уу (жишээ: 236)');
      return;
    }
    router.push(`/${Number(value)}`);
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Төлбөр шалгах" subtitle="Өөрийн тоотоо оруулна уу" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="flat" className="mb-2 block text-sm font-medium text-slate-700">
            Тоот
          </label>
          <input
            id="flat"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="236"
            value={flatNumber}
            onChange={(e) => {
              setFlatNumber(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'flat-error' : undefined}
            className="w-full rounded-xl border border-slate-300 px-4 py-4 text-center text-3xl font-bold tabular-nums tracking-wider outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 md:py-5 md:text-4xl"
          />
          {error && (
            <p id="flat-error" role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-4 py-4 font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]"
        >
          Харах
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
        Тоот олдохгүй бол СӨХ-ийн бүртгэлд ороогүй байж магадгүй.
        <br />
        Холбоо барих хэсгээс мэдэгдээрэй.
      </p>
    </div>
  );
}
