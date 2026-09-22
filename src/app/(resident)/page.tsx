import Link from 'next/link';
import { AnnouncementCard } from '@/components/home/AnnouncementCard';
import { createAdminClient } from '@/lib/supabase/admin';
import { SOH } from '@/lib/soh-config';
import type { Announcement } from '@/lib/types';

/** Мэдээг 5 минут кэшлэнэ — Supabase-ийн үнэгүй давхаргад ачаалал бууруулна */
export const revalidate = 300;

/**
 * Эхний дэлгэц — СӨХ-ийн мэдээ, зарлал.
 *
 * Оршин суугч анх ороход тоот асуухгүй. Мэдээллийг шууд харуулж, төлбөрөө
 * шалгах нь тусдаа сонголт байна.
 *
 * Байршуулалт: гар утсан дээр нэг багана, веб дээр зүүн талд үйлдлүүд,
 * баруун талд зарлалын урсгал.
 */
async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('announcements')
      .select('id, kind, title, body, is_pinned, published_at')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      // Онцлох нь үргэлж дээр, дараа нь шинэ нь дээр
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(20);

    // Хүснэгт хараахан үүсээгүй бол дэлгэц унахгүй — хоосон жагсаалт буцаана
    if (error) return [];
    return (data ?? []) as Announcement[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const announcements = await fetchAnnouncements();

  return (
    <div className="md:grid md:grid-cols-[20rem_minmax(0,1fr)] md:items-start md:gap-8">
      {/* ── Зүүн багана: үйлдэл ба заавар ─────────────────────────────────── */}
      <div className="space-y-4 md:sticky md:top-24">
        {/* Гол үйлдэл — хамгийн их дардаг зүйл тул дээр, том */}
        <Link
          href="/tolbor"
          className="group block overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] md:p-6"
        >
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 md:h-12 md:w-12"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 md:h-7 md:w-7"
              >
                <path d="M9 12h6m-6 4h6m-6-8h6M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2Z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold md:text-lg">Төлбөрөө шалгах</p>
              <p className="mt-0.5 text-sm text-slate-300">Тоотоо оруулаад үлдэгдлээ харна</p>
            </div>
            <span aria-hidden className="text-slate-400 transition group-hover:translate-x-0.5">
              →
            </span>
          </div>
        </Link>

        {/* Гүйлгээний утгын дүрэм — автомат тулгалт үүнээс шалтгаална */}
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:text-base">
          <span aria-hidden className="text-base leading-none">⚠️</span>
          <p>{SOH.transferRule}</p>
        </div>

        {/* Данс руу хөтлөх нэмэлт холбоос — веб дээр зүүн багана хоосон харагдахгүй */}
        <Link
          href="/dans"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <span aria-hidden>💳</span>
          Дансны дугаарууд
          <span aria-hidden className="ml-auto text-slate-400">
            →
          </span>
        </Link>
      </div>

      {/* ── Баруун багана: зарлалын урсгал ────────────────────────────────── */}
      <section className="mt-6 md:mt-0">
        <div className="mb-3 flex items-baseline justify-between md:mb-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 md:text-2xl">Мэдээ, зарлал</h2>
          {announcements.length > 0 && (
            <span className="text-xs text-slate-400 md:text-sm">{announcements.length} зарлал</span>
          )}
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center md:py-16">
            <p aria-hidden className="text-2xl md:text-4xl">
              📭
            </p>
            <p className="mt-2 text-sm font-medium text-slate-600 md:text-base">
              Одоогоор шинэ зарлал байхгүй
            </p>
            <p className="mt-1 text-xs text-slate-400 md:text-sm">Шинэ мэдээлэл гарвал энд харагдана.</p>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {announcements.map((item) => (
              <AnnouncementCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
