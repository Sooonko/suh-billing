'use client';

import Link from 'next/link';
import type { Announcement } from '@/lib/types';
import { KIND } from './announcement-kind';
import { useUnseen } from './news-hooks';

/**
 * «📢 2 шинэ зарлал — Халуун ус тасарна» гэсэн сануулга.
 *
 * ЯАГААД: ихэнх оршин суугч шууд «Төлбөрөө шалгах» дарж, тоотын дэлгэц
 * рүү ороод гардаг — мэдээний хэсэг тэр замд огт тааралддаггүй. Тиймээс
 * мэдээг хүний ирдэг газар руу нь аваачна.
 *
 * Уншаагүй зарлал байхгүй бол ЮУ Ч ГАРГАХГҮЙ — байнга харагдах сануулга
 * удалгүй «зар сурталчилгаа» болж, нүд нь давж харж сурдаг.
 *
 * `target`:
 *  · `home` — нүүр хуудсанд (гар утас), доорх мэдээ рүү гүйлгэнэ
 *  · `flat` — тоотын дэлгэцэнд, мэдээ рүү шилжинэ
 */
export function NewsTeaser({ items, target }: { items: Announcement[]; target: 'home' | 'flat' }) {
  const unseen = useUnseen(items);
  if (!unseen || unseen.length === 0) return null;

  // Хамгийн чухал нь: яаралтай → онцлох → шинэ нь
  const rank = (a: Announcement) => (a.kind === 'URGENT' ? 0 : a.is_pinned ? 1 : 2);
  const top = [...unseen].sort(
    (a, b) => rank(a) - rank(b) || b.published_at.localeCompare(a.published_at),
  )[0];
  const kind = KIND[top.kind] ?? KIND.INFO;
  const urgent = top.kind === 'URGENT';

  const href =
    target === 'home' ? '#news' : unseen.length === 1 ? `/medee/${top.id}` : '/#news';

  return (
    <Link
      href={href}
      className={`group mb-4 flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm transition active:scale-[0.99] md:mb-6 ${
        urgent
          ? 'border-red-200 bg-red-50 hover:bg-red-100/70'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      } ${target === 'home' ? 'md:hidden' : ''}`}
    >
      <span aria-hidden className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-slate-200">
        {kind.icon}
        <span className="absolute -right-1 -top-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-red-600" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-bold ${urgent ? 'text-red-700' : 'text-slate-500'}`}>
          {unseen.length === 1 ? 'Шинэ зарлал' : `${unseen.length} шинэ зарлал`}
        </span>
        <span className="block truncate text-sm font-semibold text-slate-900">{top.title}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-900">
        Унших →
      </span>
    </Link>
  );
}
