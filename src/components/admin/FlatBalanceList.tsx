'use client';

import Link from 'next/link';
import { formatMnt } from '@/lib/format';
import { CATEGORIES, type BillCategory } from '@/lib/types';

/**
 * Айлуудын төлбөрийн жагсаалт.
 *
 * Эх сурвалж нь v_flat_balances view — үлдэгдлийг хадгалдаггүй, үргэлж
 * `Σнэхэмжлэл − Σхуваарилалт` гэж боддог. Тиймээс энэ жагсаалт нь
 * оршин суугчийн харж буй тоотой ХЭЗЭЭ Ч зөрөхгүй.
 */

export interface FlatBalance {
  flatNumber: number;
  ownerName: string | null;
  /** Ангилал бүрийн [нэхэмжилсэн, төлсөн, үлдэгдэл] */
  byCategory: Record<BillCategory, { billed: number; paid: number; balance: number }>;
  totalBilled: number;
  totalPaid: number;
  totalBalance: number;
}

/** Үлдэгдлийн тэмдгээс хамаарсан өнгө */
function tone(value: number): string {
  if (value > 0) return 'text-red-700';
  if (value < 0) return 'text-blue-700';
  return 'text-slate-400';
}

export function FlatBalanceList({
  flats,
  category,
  summary,
  pagination,
}: {
  /** Энэ ХУУДАСНЫ айлууд */
  flats: FlatBalance[];
  /** null = бүх ангилал зэрэг */
  category: BillCategory | null;
  /** Шүүсэн БҮХ айлын нийлбэр — хуудаслалтаас үл хамаарна */
  summary: { count: number; billed: number; paid: number; balance: number };
  /** Хүснэгтийн доорх хуудаслалт */
  pagination?: React.ReactNode;
}) {
  if (flats.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
        Тохирох айл олдсонгүй.
      </div>
    );
  }

  const { billed: totalBilled, paid: totalPaid, balance: totalBalance } = summary;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[38rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 text-left font-medium">Тоот</th>
              <th className="px-2 py-2 text-left font-medium">Эзэн</th>
              {category ? (
                <>
                  <th className="px-3 py-2 text-right font-medium">Нэхэмжилсэн</th>
                  <th className="px-3 py-2 text-right font-medium">Төлсөн</th>
                  <th className="px-3 py-2 text-right font-medium">Үлдэгдэл</th>
                </>
              ) : (
                <>
                  {CATEGORIES.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Нийт төлсөн</th>
                  <th className="px-3 py-2 text-right font-medium">Нийт үлдэгдэл</th>
                </>
              )}
              <th className="px-2 py-2" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {flats.map((flat) => {
              const one = category ? flat.byCategory[category] : null;
              return (
                <tr key={flat.flatNumber} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold tabular-nums">{flat.flatNumber}</td>
                  <td className="max-w-44 truncate px-2 py-2 text-xs text-slate-500">
                    {flat.ownerName ?? ''}
                  </td>

                  {one ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {formatMnt(one.billed)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-700">
                        {one.paid === 0 ? '—' : formatMnt(one.paid)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${tone(one.balance)}`}>
                        {formatMnt(one.balance)}
                      </td>
                    </>
                  ) : (
                    <>
                      {CATEGORIES.map((c) => {
                        const cell = flat.byCategory[c.key];
                        return (
                          <td
                            key={c.key}
                            className={`px-3 py-2 text-right tabular-nums ${tone(cell.balance)}`}
                          >
                            {formatMnt(cell.balance)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-700">
                        {flat.totalPaid === 0 ? '—' : formatMnt(flat.totalPaid)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold tabular-nums ${tone(flat.totalBalance)}`}
                      >
                        {formatMnt(flat.totalBalance)}
                      </td>
                    </>
                  )}

                  <td className="px-2 py-2 text-right">
                    <Link
                      href={`/${flat.flatNumber}`}
                      target="_blank"
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Харах
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">Нийт {summary.count.toLocaleString('mn-MN')} айл</span>
        <div className="flex flex-wrap items-baseline gap-x-6 text-sm">
          <span className="text-slate-500">
            Нэхэмжилсэн <span className="font-semibold tabular-nums text-slate-900">{formatMnt(totalBilled)}</span>
          </span>
          <span className="text-slate-500">
            Төлсөн <span className="font-semibold tabular-nums text-emerald-700">{formatMnt(totalPaid)}</span>
          </span>
          <span className="text-slate-500">
            Үлдэгдэл{' '}
            <span className={`text-lg font-bold tabular-nums ${tone(totalBalance)}`}>
              {formatMnt(totalBalance)}
            </span>
          </span>
        </div>
      </div>
      {pagination}
    </div>
  );
}
