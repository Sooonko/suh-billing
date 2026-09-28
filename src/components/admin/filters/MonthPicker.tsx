'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Сар сонгогч — `<input type="month">`.
 *
 * ЯАГААД СУМТАЙ ЦЭСЭЭС САЛСАН БЭ:
 * Өмнө нь ‹ › сум + цэс байсан бөгөөд цэс нь нэхэмжлэл АЛЬ ХЭДИЙН
 * байгаа саруудыг л харуулдаг. Тиймээс хуучин сард (6, 7 сар) шинээр
 * нэхэмжлэл нэмэх гэвэл тэр сар цэсэнд байхгүй тул тийш орох арга
 * байхгүй болдог байв — гогцоо.
 *
 * Хөтчийн сар сонгогч нь дурын сарыг хүлээж авна, бас он сольж
 * сонгоход хялбар.
 */
export function MonthPicker({
  current,
  /** «Бүх хугацаа» сонголт нэмэх эсэх (хоосон болгож болно) */
  allowEmpty = false,
  emptyLabel = 'Бүх хугацаа',
}: {
  current: string | null;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  /**
   * Supabase хол байгаа тул сар солиход 1–2 секунд зарцуулагдана. Энэ
   * хугацаанд ямар ч тэмдэг байхгүй бол «дарсан уу, үгүй юу» гэж
   * эргэлзэж, дахин дахин дардаг.
   */
  const [pending, startTransition] = useTransition();

  /** Бусад шүүлтийг хэвээр хадгалаад зөвхөн сарыг сольсон URL */
  function go(month: string | null) {
    const next = new URLSearchParams(params.toString());
    if (month) next.set('month', month);
    else next.delete('month');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        aria-label="Сар"
        value={current ?? ''}
        onChange={(e) => go(e.target.value || null)}
        className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-medium tabular-nums outline-none transition focus:border-slate-900"
      />
      {pending && <Spinner label="Сар солиж байна" />}
      {allowEmpty && current && (
        <button
          type="button"
          onClick={() => go(null)}
          className="h-9 px-1 text-sm text-slate-400 underline decoration-slate-300 transition hover:text-slate-700"
        >
          {emptyLabel}
        </button>
      )}
    </div>
  );
}

/** Ачаалж байгааг хэлэх эргэлдэгч тэмдэг */
export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="shrink-0">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin text-slate-400">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
