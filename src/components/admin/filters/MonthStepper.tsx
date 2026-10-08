'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { MonthInput } from '@/components/ui/MonthInput';
import { Spinner, StepButton } from './MonthPicker';

/**
 * Сарын сонголт: ‹ [2026 оны 9 сар ▾] › — ЗӨВХӨН дататай сарууд.
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
    // Шүүлт өөрчлөгдвөл 1-р хуудас руу — эс бөгөөс хэтэрсэн хуудас хоосон гарна
    next.delete('page');
    if (month) next.set('month', month);
    else next.delete('month');
    return `?${next.toString()}`;
  };

  const index = current ? months.indexOf(current) : -1;
  // months нь БУУРАХААР эрэмбэлэгдсэн: index+1 нь илүү хуучин сар
  // «Бүх хугацаа» үед ‹ дарвал хамгийн сүүлийн сар руу орно
  const older =
    current === null ? (months[0] ?? null) : index >= 0 && index + 1 < months.length ? months[index + 1] : null;
  const newer = index > 0 ? months[index - 1] : null;

  return (
    <div className="flex items-center gap-1.5">
      <StepButton label="Өмнөх сар" disabled={!older} onClick={() => older && go(hrefFor(older))}>
        ‹
      </StepButton>
      <MonthInput
        value={current}
        onChange={(m) => go(hrefFor(m))}
        // Дата байхгүй сарыг сонгох нь утгагүй — бүдгэрүүлнэ
        selectable={months}
        marked={[]}
        allowEmpty={allowAll}
        emptyLabel={allLabel}
      />
      <StepButton label="Дараах сар" disabled={!newer} onClick={() => newer && go(hrefFor(newer))}>
        ›
      </StepButton>
      {pending && <Spinner label="Сар солиж байна" />}
    </div>
  );
}
