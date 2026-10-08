import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShareButton } from '@/components/home/AnnouncementFeed';
import { KIND } from '@/components/home/announcement-kind';
import { MarkSeen } from '@/components/home/MarkSeen';
import { loadAnnouncement } from '@/lib/announcements';
import { shortDate } from '@/lib/news-seen';
import { SOH } from '@/lib/soh-config';

/** Нүүр хуудастай ижил — 5 минут кэшлэнэ, админ засахад шууд шинэчлэгдэнэ */
export const revalidate = 300;

/**
 * Нэг зарлалын хуудас — `/medee/<id>`.
 *
 * ЯАГААД: админ зарлалын холбоосыг Facebook групп, орцны Messenger чат
 * руу тавихад гарчиг, тайлбартай урьдчилсан харагдац (preview) гарна.
 * Тэр нь Open Graph meta tag — ямар ч бүртгэл, төлбөр шаардахгүй.
 * Чатаас шууд сайт руу ирэх урсгал бий болно.
 */

type Props = { params: Promise<{ id: string }> };

/** Preview-ийн тайлбар — эхний ~160 тэмдэгт, мөр таслалгүй */
function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 157).trimEnd()}…` : flat;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await loadAnnouncement(id);
  if (!item) return { title: `Зарлал олдсонгүй · ${SOH.name.trim()}` };

  const kind = KIND[item.kind] ?? KIND.INFO;
  const title = `${kind.icon} ${item.title}`;
  const description = excerpt(item.body);
  return {
    title: `${item.title} · ${SOH.name.trim()}`,
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      siteName: SOH.name.trim(),
      publishedTime: item.published_at,
      locale: 'mn_MN',
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function AnnouncementPage({ params }: Props) {
  const { id } = await params;
  const item = await loadAnnouncement(id);
  if (!item) notFound();

  const kind = KIND[item.kind] ?? KIND.INFO;

  return (
    <div className="mx-auto max-w-2xl">
      <MarkSeen id={item.id} />

      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <span aria-hidden>←</span> Бүх мэдээ
      </Link>

      <article className={`overflow-hidden rounded-2xl border p-5 shadow-sm md:p-8 ${kind.hero}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ring-1 ring-inset ${kind.badge}`}
          >
            <span aria-hidden>{kind.icon}</span>
            {kind.label}
          </span>
          {item.is_pinned && <span className="text-xs font-semibold text-slate-500">📌 Онцлох</span>}
          <time dateTime={item.published_at} className="ml-auto text-sm text-slate-500">
            {shortDate(item.published_at)}
          </time>
        </div>

        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-slate-900 md:text-3xl">
          {item.title}
        </h1>
        {/* whitespace-pre-line — админ мөр шинээр бичсэнийг хадгална */}
        <p className="mt-4 whitespace-pre-line wrap-break-word text-base leading-relaxed text-slate-700">
          {item.body}
        </p>

        <div className="mt-6 flex items-center border-t border-slate-200/80 pt-4">
          <ShareButton id={item.id} title={item.title} className="-ml-2 text-sm" />
        </div>
      </article>

      {/* Чатаас орж ирсэн хүнийг үндсэн үйлдэл рүү хөтөлнө */}
      <Link
        href="/tolbor"
        className="group mt-4 flex items-center gap-4 rounded-2xl bg-slate-900 p-5 text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Төлбөрөө шалгах</span>
          <span className="mt-0.5 block text-sm text-slate-300">Тоотоо оруулаад үлдэгдлээ харна</span>
        </span>
        <span aria-hidden className="text-slate-400 transition group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  );
}
