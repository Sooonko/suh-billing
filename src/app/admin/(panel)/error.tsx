'use client';

/**
 * Админы хуудасны алдаа — цэс хэвээр үлдэнэ, «Дахин оролдох» товчтой.
 *
 * Өмнө нь энэ файл байгаагүй тул датабазын түр алдаа гарахад БҮТЭН
 * дэлгэц (global-error) солигдож, админ цэсээ ч алддаг байв.
 *
 * Админд мессежийг харуулна — оршин суугчийн дэлгэцээс ялгаатай нь
 * алдааны шалтгааныг мэдэх нь засахад тусална.
 */
export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <p className="text-4xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-3 text-lg font-bold text-slate-900">Хуудас ачаалагдсангүй</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        Сервертэй холбогдоход түр алдаа гарсан байж магадгүй. Дахин оролдоно уу.
      </p>
      {error.message && (
        <p className="mt-3 wrap-break-word rounded-lg bg-slate-200/60 px-3 py-2 font-mono text-xs text-slate-600">
          {error.message}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Дахин оролдох
      </button>
    </div>
  );
}
