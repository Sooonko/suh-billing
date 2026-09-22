'use client';

import { useMemo, useState } from 'react';
import { formatBillingMonth, formatMnt } from '@/lib/format';
import { CATEGORIES, CATEGORY_LABEL, type BillCategory, type PaymentEntry } from '@/lib/types';

/**
 * Төлсөн баримтууд — «би хэзээ хэдийг төлсөн бэ».
 *
 * Зөвхөн ТӨЛБӨР харуулна. Нэхэмжлэлийг энд холихгүй — тэр нь дээрх
 * картуудад аль хэдийн байгаа бөгөөд хольсноор хүснэгт ойлгомжгүй болдог.
 */

const TONE: Record<BillCategory, string> = {
  WATER_HEAT: 'bg-sky-100 text-sky-900',
  SOH: 'bg-slate-100 text-slate-700',
  ELECTRICITY: 'bg-amber-100 text-amber-900',
};

/** "2026-09-20T…" → "9 сарын 20" */
function showDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1} сарын ${d.getDate()}`;
}

export function PaymentList({ payments }: { payments: PaymentEntry[] }) {
  const months = useMemo(
    () => [...new Set(payments.map((p) => p.month))].sort((a, b) => b.localeCompare(a)),
    [payments],
  );

  // Хамгийн сүүлийн сар анхдагчаар
  const [month, setMonth] = useState(months[0] ?? '');
  const [category, setCategory] = useState<BillCategory | ''>('');

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center">
        <p className="text-sm font-medium text-slate-600">Төлбөр хараахан бүртгэгдээгүй</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Банкаар төлсөн төлбөр 1–2 хоногийн дотор энд тусна.
        </p>
      </div>
    );
  }

  const rows = payments.filter(
    (p) => (month === '' || p.month === month) && (category === '' || p.category === category),
  );
  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          aria-label="Сар"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        >
          <option value="">Бүх сар</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {formatBillingMonth(m)}
            </option>
          ))}
        </select>

        <select
          aria-label="Ангилал"
          value={category}
          onChange={(e) => setCategory(e.target.value as BillCategory | '')}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        >
          <option value="">Бүх ангилал</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Энэ шүүлтэд тохирох төлбөр байхгүй.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 text-left font-medium">Огноо</th>
                  <th className="px-3 py-2 text-left font-medium">Ангилал</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                    Тухайн сарын нэхэмжлэл
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Төлсөн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {showDate(payment.date)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[payment.category]}`}
                      >
                        {CATEGORY_LABEL[payment.category]}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell">
                      {payment.billedThatMonth === null ? '—' : formatMnt(payment.billedThatMonth)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                      {formatMnt(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-baseline justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-600">{rows.length} төлбөр</span>
              <span className="font-bold tabular-nums text-emerald-700">{formatMnt(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
