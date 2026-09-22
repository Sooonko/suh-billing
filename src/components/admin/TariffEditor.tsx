'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Tariff, TariffUnit } from '@/lib/types';

/**
 * Тарифын цэс — ангилал бүр нэг хүснэгт.
 *
 * ⚠️ Тарифыг ЗАСАХГҮЙ — солино. Хуучин мөр огноогоор хаагдаж, шинэ мөр
 * үүснэ. Ингэснээр өнгөрсөн сарын нэхэмжлэлийн задаргаа зөв хэвээр үлдэнэ.
 */

const UNIT_LABEL: Record<TariffUnit, string> = {
  PER_M3: '₮ / м³',
  PER_KWH: '₮ / кВт·ц',
  CAPACITY: '₮ / кВт',
  FIXED: '₮ / сар',
  NUMBER: '',
  PERCENT: '%',
};

const UNIT_HINT: Record<TariffUnit, string> = {
  PER_M3: 'нийт хэрэглээгээр үржүүлнэ',
  PER_KWH: 'кВт·цаг тутамд',
  CAPACITY: 'дундаж чадлын төлбөр',
  FIXED: 'хэрэглээнээс хамаарахгүй',
  NUMBER: 'томьёоны орц — мөнгө биш',
  PERCENT: 'бусад мөрийн нийлбэрээс',
};

/** 1234.5 → "1,234.5" */
const num = (value: number) =>
  new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 4 }).format(value);

/** Дараа сарын 1 — тариф ихэвчлэн сарын эхнээс өөрчлөгддөг */
function nextMonthStart(): string {
  const d = new Date();
  const year = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  const month = d.getMonth() === 11 ? 1 : d.getMonth() + 2;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function ChangeRow({ tariff, onDone }: { tariff: Tariff; onDone: () => void }) {
  const router = useRouter();
  const [rate, setRate] = useState(String(tariff.rate));
  const [effectiveFrom, setEffectiveFrom] = useState(nextMonthStart());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);

    const response = await fetch('/api/admin/tariffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: tariff.category,
        code: tariff.code,
        entrance: tariff.entrance,
        label: tariff.label,
        unit: tariff.unit,
        rate,
        effectiveFrom,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? 'Алдаа гарлаа');
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <tr className="bg-amber-50">
      <td colSpan={5} className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Шинэ утга</label>
            <input
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Хүчинтэй болох өдөр
            </label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? '…' : 'Солих'}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Болих
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

export function TariffEditor({ current, history }: { current: Tariff[]; history: Tariff[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {current.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center text-sm text-slate-500">
          Энэ ангилалд тариф бүртгэгдээгүй байна.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2 text-left font-medium">Нэр</th>
                <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Код</th>
                <th className="hidden px-3 py-2 text-left font-medium lg:table-cell">Тайлбар</th>
                <th className="px-3 py-2 text-right font-medium">Утга</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {current.map((tariff) => (
                <Fragment key={tariff.id}>
                  <tr className={editing === tariff.id ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900">{tariff.label}</span>
                      {/* Орц тусгайлсан тариф — ерөнхийг нь дардаг тул ЗААВАЛ ялгана */}
                      {tariff.entrance !== null && (
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900">
                          {tariff.entrance} орц
                        </span>
                      )}
                      <span className="block text-xs text-slate-400">
                        {tariff.effective_from}-нээс
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                        {tariff.code}
                      </code>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-slate-500 lg:table-cell">
                      {UNIT_HINT[tariff.unit]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <span className="text-base font-bold tabular-nums text-slate-900">
                        {num(tariff.rate)}
                      </span>
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        {UNIT_LABEL[tariff.unit]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(editing === tariff.id ? null : tariff.id)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        {editing === tariff.id ? 'Хаах' : 'Солих'}
                      </button>
                    </td>
                  </tr>

                  {editing === tariff.id && (
                    <ChangeRow tariff={tariff} onDone={() => setEditing(null)} />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <details className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-slate-600">
            Түүх ({history.length})
          </summary>
          <table className="w-full border-t border-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Нэр</th>
                <th className="px-3 py-2 text-right font-medium">Утга</th>
                <th className="px-4 py-2 text-right font-medium">Хүчинтэй байсан</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((tariff) => (
                <tr key={tariff.id} className="text-slate-500">
                  <td className="px-4 py-2">
                  {tariff.label}
                  {tariff.entrance !== null && (
                    <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-900">
                      {tariff.entrance} орц
                    </span>
                  )}
                </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {num(tariff.rate)} {UNIT_LABEL[tariff.unit]}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-xs">
                    {tariff.effective_from} → {tariff.effective_to}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            Эдгээр нь өнгөрсөн сарын нэхэмжлэлийг тайлбарлахад хэрэглэгдэнэ.
          </p>
        </details>
      )}
    </div>
  );
}
