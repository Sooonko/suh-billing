'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/ui/Feedback';
import { MonthInput } from '@/components/ui/MonthInput';
import { callApi } from '@/lib/api-client';
import { formatBillingMonth, formatMnt } from '@/lib/format';

/**
 * СӨХ-ийн сарын хураамжийг бүх айлд нэг дор үүсгэх.
 *
 * Тоолуургүй, бүх айлд ижил дүн тул Excel импорт хэрэггүй. Дүнг тарифын
 * хүснэгтээс авна — энд гараар бичихгүй, ингэснээр хураамж өөрчлөгдөхөд
 * /admin/tariffs дээр нэг л газар засна.
 */

interface Preview {
  flats: number;
  replacing: number;
  amount: number;
  totalAmount: number;
}

interface Result {
  created: number;
  replaced: number;
  amount: number;
  totalAmount: number;
}

/** Өнөөдрийн сар — "2026-09" */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function SohGenerator() {
  const router = useRouter();
  const confirm = useConfirm();
  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'check' | 'run' | null>(null);

  async function send(dryRun: boolean) {
    setBusy(dryRun ? 'check' : 'run');
    setError(null);

    const response = await callApi<Preview | Result>('/api/admin/invoices/generate', {
      method: 'POST',
      json: { category: 'SOH', billingMonth, dryRun },
    });
    setBusy(null);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    if (dryRun) setPreview(response.data as Preview);
    else {
      setResult(response.data as Result);
      setPreview(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="soh-month" className="mb-1 block text-xs font-medium text-slate-500">
            Тооцооны сар
          </label>
          <MonthInput
            id="soh-month"
            ariaLabel="Тооцооны сар"
            value={billingMonth || null}
            onChange={(m) => {
              setBillingMonth(m ?? '');
              setPreview(null);
              setResult(null);
            }}
          />
        </div>

        {!preview && !result && (
          <button
            type="button"
            onClick={() => send(true)}
            disabled={busy !== null}
            className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === 'check' ? 'Шалгаж байна…' : 'Шалгах'}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {preview && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-slate-500">Айлын тоо</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">{preview.flats}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Айл тус бүрт</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">
                {formatMnt(preview.amount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Нийт дүн</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">
                {formatMnt(preview.totalAmount)}
              </dd>
            </div>
          </dl>

          {preview.replacing > 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              ⚠️ {formatBillingMonth(billingMonth)}-д аль хэдийн{' '}
              <span className="font-semibold">{preview.replacing}</span> нэхэмжлэл байна — ДАРЖ
              бичнэ. Төлбөр (хуваарилалт) хөндөгдөхгүй.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: 'СӨХ-ийн нэхэмжлэл үүсгэх үү?',
                  details: [
                    ['Сар', formatBillingMonth(billingMonth)],
                    ['Айлын тоо', String(preview.flats)],
                    ['Айл тус бүрт', formatMnt(preview.amount)],
                    ['Нийт дүн', formatMnt(preview.totalAmount)],
                  ],
                  warning:
                    preview.replacing > 0
                      ? `${preview.replacing} нэхэмжлэл аль хэдийн байгаа тул ДАРЖ бичнэ.`
                      : undefined,
                  confirmLabel: 'Үүсгэх',
                  tone: 'success',
                });
                if (ok) send(false);
              }}
              disabled={busy !== null}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === 'run' ? 'Үүсгэж байна…' : `${preview.flats} нэхэмжлэл үүсгэх`}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Болих
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">✓ Үүсгэгдлээ</p>
          <p className="mt-1">
            {result.created} нэхэмжлэл · айл тус бүрт {formatMnt(result.amount)} · нийт{' '}
            {formatMnt(result.totalAmount)}
            {result.replaced > 0 && ` · үүнээс ${result.replaced} нь дарж бичигдсэн`}
          </p>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-3 rounded-lg border border-emerald-300 bg-white px-4 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            Хаах
          </button>
        </div>
      )}
    </div>
  );
}
