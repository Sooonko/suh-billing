'use client';

import Link from 'next/link';

/**
 * Оршин суугчийн дэлгэцийн алдаа — цэс, толгой хэвээр байна.
 *
 * Техникийн текстийг ХАРУУЛАХГҮЙ: датабазын алдааны мессеж дотор дансны
 * бүтэц, багана нэр гарч ирж болзошгүй.
 */
export default function ResidentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-10 text-center">
      <p className="text-4xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-3 text-lg font-bold text-slate-900">Мэдээлэл ачаалагдсангүй</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-600">
        Түр хугацааны алдаа байж магадгүй. Дахин оролдоод болохгүй бол СӨХ-тэй
        холбогдоно уу.
      </p>

      <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          Дахин оролдох
        </button>
        <Link
          href="/holboo"
          className="rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-white"
        >
          Холбоо барих
        </Link>
      </div>
    </div>
  );
}
