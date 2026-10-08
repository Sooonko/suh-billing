import Link from 'next/link';

/**
 * Зарлал олдсонгүй — устсан, нуусан, хугацаа нь дууссан, эсвэл холбоос буруу.
 *
 * Чатаар хуваалцсан хуучин холбоосоор орж ирсэн хүнд «Тоот олдсонгүй»
 * (ерөнхий not-found) гэж харуулбал ойлгомжгүй тул тусад нь.
 */
export default function AnnouncementNotFound() {
  return (
    <div className="py-10 text-center">
      <p className="text-4xl" aria-hidden>
        📭
      </p>
      <h1 className="mt-3 text-lg font-bold text-slate-900">Зарлал олдсонгүй</h1>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-600">
        Энэ зарлалын хугацаа дууссан эсвэл хасагдсан байна.
      </p>
      <div className="mx-auto mt-5 flex max-w-xs flex-col gap-2">
        <Link
          href="/"
          className="rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          Бүх мэдээ
        </Link>
      </div>
    </div>
  );
}
