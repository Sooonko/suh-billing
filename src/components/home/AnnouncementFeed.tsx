'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { isRecent, markSeen, relativeTime, shortDate } from '@/lib/news-seen';
import type { Announcement } from '@/lib/types';
import { KIND } from './announcement-kind';
import { useNewSnapshot, useNow } from './news-hooks';

/**
 * Нүүр хуудасны мэдээний урсгал.
 *
 * ЗОРИЛГО: оршин суугч мэдээг ГҮЙЛГЭЭД өнгөрөхгүй байх. Өмнө нь 20
 * зарлал бүгд адилхан карт, бүтэн текстээрээ байсан тул яаралтай
 * мэдээ ч 2 сарын өмнөх мэдээлэлтэй ижил жинтэй харагддаг байв.
 *
 * Одоо:
 *  · Онцлох, яаралтай → ТОМ карт (hero), өнгөт дэвсгэртэй
 *  · Бусад → нягт карт, текст нь 3 мөрөөр хураагдсан
 *  · 30 хоногоос хуучин → «Өмнөх зарлал»-ын дор хураагдана
 *  · Хараагүй зарлал → «ШИНЭ» тэмдэг (энэ төхөөрөмж дээр)
 *  · Огноо → «2 цагийн өмнө» — мэдээ амьд санагдана
 *
 * Карт дэлгэцэнд 1 секунд харагдсаны дараа «харсан» гэж тэмдэглэнэ.
 * «ШИНЭ» тэмдэг энэ айлчлалын турш хэвээр, дараагийн удаа арилна.
 */

/**
 * Урт эсэхийг ТЕКСТЭЭР нь шийднэ (DOM хэмжихгүй) — сервер ба хөтөч ижил
 * хариу өгч, «Дэлгэрэнгүй» товч анивчихгүй.
 */
function isLong(body: string, lines: number): boolean {
  return body.length > lines * 70 || body.split('\n').length > lines;
}

export function AnnouncementFeed({ items }: { items: Announcement[] }) {
  const fresh = useNewSnapshot(items);
  const now = useNow();
  const [showOld, setShowOld] = useState(false);

  // Сервер дээр «одоо»-г мэдэхгүй тул хуучин зарлалыг ялгахгүй — бүгд харагдана.
  // Хөтөч дээр ачаалагдсаны дараа хуучин нь хураагдана.
  const isOld = (item: Announcement) =>
    now !== null && !item.is_pinned && !isRecent(item.published_at, now);

  const featured = items.filter((i) => i.is_pinned || (i.kind === 'URGENT' && !isOld(i)));
  const rest = items.filter((i) => !featured.includes(i));
  const recent = rest.filter((i) => !isOld(i));
  const old = rest.filter(isOld);
  const newCount = fresh?.size ?? 0;

  return (
    <section id="news" aria-labelledby="news-title" className="scroll-mt-24">
      <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
        <h2 id="news-title" className="text-lg font-bold tracking-tight text-slate-900 md:text-2xl">
          Мэдээ, зарлал
        </h2>
        {newCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm md:text-sm">
            <span aria-hidden className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            {newCount} шинэ
          </span>
        ) : (
          items.length > 0 && (
            <span className="text-xs text-slate-400 md:text-sm">{items.length} зарлал</span>
          )
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center md:py-16">
          <p aria-hidden className="text-2xl md:text-4xl">
            📭
          </p>
          <p className="mt-2 text-sm font-medium text-slate-600 md:text-base">Одоогоор шинэ зарлал байхгүй</p>
          <p className="mt-1 text-xs text-slate-400 md:text-sm">Шинэ мэдээлэл гарвал энд харагдана.</p>
        </div>
      ) : (
        <div className="space-y-3 md:space-y-4">
          {featured.map((item) => (
            <HeroCard key={item.id} item={item} isNew={fresh?.has(item.id) ?? false} now={now} />
          ))}
          {recent.map((item) => (
            <CompactCard key={item.id} item={item} isNew={fresh?.has(item.id) ?? false} now={now} />
          ))}

          {old.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowOld((v) => !v)}
                aria-expanded={showOld}
                className="flex w-full items-center gap-3 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
              >
                <span className="h-px flex-1 bg-slate-200" />
                {showOld ? 'Өмнөх зарлалыг хураах' : `Өмнөх зарлал (${old.length})`}
                <span aria-hidden className={`transition ${showOld ? 'rotate-180' : ''}`}>
                  ▾
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </button>
              {showOld && (
                <div className="mt-3 space-y-3 opacity-90 md:space-y-4">
                  {old.map((item) => (
                    <CompactCard key={item.id} item={item} isNew={false} now={now} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Онцлох / яаралтай зарлал — анхаарал татах том карт */
function HeroCard({ item, isNew, now }: { item: Announcement; isNew: boolean; now: number | null }) {
  const kind = KIND[item.kind] ?? KIND.INFO;
  const ref = useSeenOnView(item.id);

  return (
    <article ref={ref} className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm md:p-6 ${kind.hero}`}>
      <div className="flex gap-3.5 md:gap-4">
        <span
          aria-hidden
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl shadow-sm md:h-12 md:w-12 md:text-2xl ${kind.tile}`}
        >
          {kind.icon}
        </span>
        <div className="min-w-0 flex-1">
          <Meta item={item} isNew={isNew} now={now} />
          <h3 className="mt-1.5 text-lg font-bold leading-snug text-slate-900 md:text-xl">
            <Link href={`/medee/${item.id}`} className="hover:underline">
              {item.title}
            </Link>
          </h3>
          <Body item={item} lines={4} />
        </div>
      </div>
    </article>
  );
}

/** Энгийн зарлал — нягт карт */
function CompactCard({ item, isNew, now }: { item: Announcement; isNew: boolean; now: number | null }) {
  const kind = KIND[item.kind] ?? KIND.INFO;
  const ref = useSeenOnView(item.id);

  return (
    <article
      ref={ref}
      className={`flex overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        isNew ? 'border-slate-300 ring-1 ring-red-500/10' : 'border-slate-200'
      }`}
    >
      {/* Зүүн захын өнгөт зураас — төрлийг нэг харцаар таниулна */}
      <div aria-hidden className={`w-1 shrink-0 ${kind.bar}`} />
      <div className="min-w-0 flex-1 p-4">
        <Meta item={item} isNew={isNew} now={now} />
        <h3 className="mt-1.5 font-semibold leading-snug text-slate-900">
          <Link href={`/medee/${item.id}`} className="hover:underline">
            {item.title}
          </Link>
        </h3>
        <Body item={item} lines={3} />
      </div>
    </article>
  );
}

/** Төрөл, «ШИНЭ», огноо — картын дээд мөр */
function Meta({ item, isNew, now }: { item: Announcement; isNew: boolean; now: number | null }) {
  const kind = KIND[item.kind] ?? KIND.INFO;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ring-1 ring-inset ${kind.badge}`}
      >
        <span aria-hidden>{kind.icon}</span>
        {kind.label}
      </span>
      {item.is_pinned && <span className="text-[11px] font-semibold text-slate-500">📌 Онцлох</span>}
      {isNew && (
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white">
          ШИНЭ
        </span>
      )}
      <time dateTime={item.published_at} className="ml-auto text-xs text-slate-400">
        {/* Сервер дээр огноо, хөтөч дээр «2 цагийн өмнө» */}
        {now === null ? shortDate(item.published_at) : relativeTime(item.published_at, now)}
      </time>
    </div>
  );
}

/** Агуулга — урт бол хураагдсан, «Дэлгэрэнгүй» товчтой. Хуваалцах товч. */
function Body({ item, lines }: { item: Announcement; lines: 3 | 4 }) {
  const [open, setOpen] = useState(false);
  const long = isLong(item.body, lines);

  return (
    <>
      {/* whitespace-pre-line — админ мөр шинээр бичсэнийг хадгална */}
      <p
        className={`mt-1.5 whitespace-pre-line wrap-break-word text-sm leading-relaxed text-slate-600 md:text-[15px] ${
          long && !open ? (lines === 4 ? 'line-clamp-4' : 'line-clamp-3') : ''
        }`}
      >
        {item.body}
      </p>
      <div className="mt-2.5 flex items-center gap-4">
        {long && (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              markSeen([item.id]);
            }}
            aria-expanded={open}
            className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900"
          >
            {open ? 'Хураах' : 'Дэлгэрэнгүй'}
          </button>
        )}
        <ShareButton id={item.id} title={item.title} className="ml-auto" />
      </div>
    </>
  );
}

/**
 * Хуваалцах — утсан дээр системийн хуваалцах цонх (Messenger, Viber…),
 * компьютер дээр холбоосыг хуулна.
 */
export function ShareButton({ id, title, className = '' }: { id: string; title: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'fail'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function share() {
    const url = `${window.location.origin}/medee/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Хэрэглэгч өөрөө болиулсан — хуулах руу шилжихгүй
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('fail');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
      </svg>
      {state === 'copied' ? 'Холбоос хуулсан ✓' : state === 'fail' ? 'Хуулж чадсангүй' : 'Хуваалцах'}
    </button>
  );
}

/**
 * Карт дэлгэцэнд тал хувь нь 1 секунд харагдвал «харсан» гэж тэмдэглэнэ.
 * Хурдан гүйлгэж өнгөрсөн картыг тооцохгүй.
 */
function useSeenOnView(id: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        // Дэлгэцээс өндөр (дэлгэрүүлсэн) карт хэзээ ч 50% харагдахгүй —
        // дэлгэцийн 40%-ийг эзэлж байвал мөн харсан гэж үзнэ
        const visible =
          entry.isIntersecting &&
          (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= window.innerHeight * 0.4);
        if (visible) {
          timer = setTimeout(() => {
            markSeen([id]);
            observer.disconnect();
          }, 1000);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [id]);
  return ref;
}
