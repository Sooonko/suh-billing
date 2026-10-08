'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { MonthInput, shiftMonth } from '@/components/ui/MonthInput';

/**
 * Сар сонгогч — ДУРЫН сар (нэхэмжлэл).
 *
 * ЯАГААД ДУРЫН САР: сонголт нь нэхэмжлэл АЛЬ ХЭДИЙН байгаа саруудаар
 * хязгаарлагдвал хуучин сард (6, 7 сар) шинээр нэхэмжлэл нэмэх гэхэд тэр
 * сар цэсэнд байхгүй тул тийш орох арга байхгүй болдог — гогцоо.
 * Дататай сарууд ногоон цэгээр тэмдэглэгдэнэ.
 *
 * ‹ › сум — админ ихэвчлэн өмнөх/дараах сар руу л хардаг.
 */
export function MonthPicker({
  current,
  marked,
  /** «Бүх хугацаа» сонголт нэмэх эсэх (хоосон болгож болно) */
  allowEmpty = false,
  emptyLabel = 'Бүх хугацаа',
}: {
  current: string | null;
  /** Дата байгаа сарууд */
  marked?: string[];
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
    // Шүүлт өөрчлөгдвөл 1-р хуудас руу — эс бөгөөс хэтэрсэн хуудас хоосон гарна
    next.delete('page');
    if (month) next.set('month', month);
    else next.delete('month');
    startTransition(() => router.push(`?${next.toString()}`));
  }

  return (
    <div className="flex items-center gap-1.5">
      <StepButton label="Өмнөх сар" disabled={!current} onClick={() => current && go(shiftMonth(current, -1))}>
        ‹
      </StepButton>
      <MonthInput value={current} onChange={go} marked={marked} allowEmpty={allowEmpty} emptyLabel={emptyLabel} />
      <StepButton label="Дараах сар" disabled={!current} onClick={() => current && go(shiftMonth(current, 1))}>
        ›
      </StepButton>
      {pending && <Spinner label="Сар солиж байна" />}
    </div>
  );
}

/** ‹ › товч — хоёр сар сонгогч хоёулаа хэрэглэнэ */
export function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-base text-slate-500 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
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
