'use client';

import { useRouter, useSearchParams } from 'next/navigation';

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

  /** Бусад шүүлтийг хэвээр хадгалаад зөвхөн сарыг сольсон URL */
  function go(month: string | null) {
    const next = new URLSearchParams(params.toString());
    if (month) next.set('month', month);
    else next.delete('month');
    router.push(`?${next.toString()}`);
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
