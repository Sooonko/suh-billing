'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Spinner } from './MonthPicker';
import { formatBillingMonth } from '@/lib/format';

/**
 * Сарын сонголт: ‹ [2026 оны 9 сар ▾] ›
 *
 * ЯАГААД СУМТАЙ: админ ихэвчлэн «өмнөх сар» руу л хардаг. Цэс дэлгэж
 * сар хайхын оронд нэг дарахад хүрэхээр болгосон.
 *
 * Сар солих нь БҮХ шүүлтийг дахин ажиллуулна — тиймээс URL-ийн бусад
 * параметрийг хэвээр авч явна (ангилал, хайлт, таб).
 */
export function MonthStepper({
  months,
  current,
  /** Бүх сарыг нэг дор харах сонголт нэмэх эсэх */
  allowAll = false,
  allLabel = 'Бүх сар',
}: {
  /** Шинэ нь тэргүүнд — буурахаар эрэмбэлсэн байх ёстой */
  months: string[];
  current: string | null;
  allowAll?: boolean;
  allLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  // Дата иртэл 1–2 секунд — тэмдэггүй бол дахин дахин дардаг
  const [pending, startTransition] = useTransition();
  const go = (href: string) => startTransition(() => router.push(href));

  /** Бусад шүүлтийг хэвээр хадгалаад зөвхөн сарыг сольсон URL */
  const hrefFor = (month: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (month) next.set('month', month);
    else next.delete('month');
    return `?${next.toString()}`;
  };

  const index = current ? months.indexOf(current) : -1;
  // months нь БУУРАХААР эрэмбэлэгдсэн: index+1 нь илүү хуучин сар
  const older = index >= 0 && index + 1 < months.length ? months[index + 1] : null;
  const newer = index > 0 ? months[index - 1] : null;

  const arrow =
    'grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Өмнөх сар"
        disabled={!older}
        onClick={() => older && go(hrefFor(older))}
        className={arrow}
      >
        ‹
      </button>

      <select
        aria-label="Сар"
        value={current ?? ''}
        onChange={(e) => go(hrefFor(e.target.value || null))}
        className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-medium outline-none focus:border-slate-900"
      >
        {allowAll && <option value="">{allLabel}</option>}
        {months.map((m) => (
          <option key={m} value={m}>
            {formatBillingMonth(m)}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-label="Дараах сар"
        disabled={!newer}
        onClick={() => newer && go(hrefFor(newer))}
        className={arrow}
      >
        ›
      </button>
      {pending && <Spinner label="Сар солиж байна" />}
    </div>
  );
}
