'use client';

/**
 * Хамгийн гадна алдааны хамгаалалт — root layout өөрөө унавал зурагдана.
 * Тиймээс дотроо html/body тэгээ агуулах ёстой (layout ажиллахгүй болсон).
 *
 * Vercel дээр env хувьсагч тохируулаагүй бол оршин суугч англи «Application
 * error» гэсэн цагаан хуудас хардаг байсан — түүнийг халахын тулд нэмэв.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="mn">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-sm text-center">
            <p className="text-4xl" aria-hidden>
              ⚠️
            </p>
            <h1 className="mt-3 text-lg font-bold">Системд алдаа гарлаа</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Түр хугацааны алдаа байж магадгүй. Дахин оролдоод болохгүй бол
              СӨХ-тэй холбогдоно уу.
            </p>
            <button
              onClick={reset}
              className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Дахин оролдох
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
