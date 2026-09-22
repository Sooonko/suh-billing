import Link from 'next/link';

/**
 * Байхгүй тоот (`/999`) эсвэл байхгүй хуудас.
 * `[flat]/page.tsx` дотор notFound() дуудагдвал энэ зурагдана.
 */
export default function ResidentNotFound() {
  return (
    <div className="py-10 text-center">
      <p className="text-4xl" aria-hidden>
        🔍
      </p>
      <h1 className="mt-3 text-lg font-bold text-slate-900">Тоот олдсонгүй</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-600">
        Ийм тоот бүртгэлгүй байна. Тоотоо шалгаад дахин хайна уу.
      </p>

      <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2">
        <Link
          href="/tolbor"
          className="rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          Тоот хайх
        </Link>
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
