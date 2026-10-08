'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, pageNumbers } from '@/lib/pagination';

/**
 * Хүснэгтийн доорх хуудаслалт: «11–20 / 1,234 · ‹ 1 2 3 … › · 10 мөр».
 *
 * URL-ын БУСАД параметрийг (сар, данс, хайлт) хэвээр авч явна. Хэмжээ
 * солиход 1-р хуудас руу буцна — 50 мөрийн 7-р хуудас 10 мөрийн 7-р
 * хуудастай огт өөр мөрүүд.
 *
 * Хуудас солиход жагсаалтын ЭХЭН рүү гүйлгэнэ (`#list-top`). Эс бөгөөс
 * доод товчийг дарсан хүн шинэ хуудасны төгсгөлийг харж үлдэнэ.
 */
export function Pagination({
  page,
  pageCount,
  size,
  total,
  from,
  to,
}: {
  page: number;
  pageCount: number;
  size: number;
  total: number;
  from: number;
  to: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const hrefFor = (patch: { page?: number; size?: number }) => {
    const next = new URLSearchParams(params.toString());
    if (patch.page !== undefined) {
      if (patch.page <= 1) next.delete('page');
      else next.set('page', String(patch.page));
    }
    if (patch.size !== undefined) {
      if (patch.size === DEFAULT_PAGE_SIZE) next.delete('size');
      else next.set('size', String(patch.size));
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  // Хуудас солигдсоны ДАРАА жагсаалтын эхэн рүү гүйлгэнэ (анх ачаалахад биш)
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    const anchor = document.getElementById('list-top');
    if (anchor && anchor.getBoundingClientRect().top < 0) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page]);

  if (total === 0) return null;

  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));

  const arrow =
    'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/70 aria-disabled:pointer-events-none aria-disabled:opacity-30';

  return (
    <nav
      aria-label="Хуудаслалт"
      className={`flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 transition-opacity sm:flex-row sm:items-center sm:justify-between ${
        pending ? 'opacity-60' : ''
      }`}
    >
      <p className="text-sm text-slate-500">
        <span className="font-semibold tabular-nums text-slate-900">
          {from.toLocaleString('mn-MN')}–{to.toLocaleString('mn-MN')}
        </span>{' '}
        / {total.toLocaleString('mn-MN')}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {pageCount > 1 && (
          <ul className="flex items-center gap-0.5">
            <li>
              <PageLink
                href={hrefFor({ page: page - 1 })}
                disabled={page <= 1}
                onGo={go}
                label="Өмнөх хуудас"
                className={arrow}
              >
                ‹
              </PageLink>
            </li>
            {pageNumbers(page, pageCount).map((p, i) =>
              p === '…' ? (
                <li key={`gap-${i}`} aria-hidden className="px-1 text-sm text-slate-400">
                  …
                </li>
              ) : (
                <li key={p}>
                  <PageLink
                    href={hrefFor({ page: p })}
                    current={p === page}
                    onGo={go}
                    label={`${p}-р хуудас`}
                    className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-semibold tabular-nums transition ${
                      p === page ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {p}
                  </PageLink>
                </li>
              ),
            )}
            <li>
              <PageLink
                href={hrefFor({ page: page + 1 })}
                disabled={page >= pageCount}
                onGo={go}
                label="Дараагийн хуудас"
                className={arrow}
              >
                ›
              </PageLink>
            </li>
          </ul>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-500">
          <span className="sr-only sm:not-sr-only">Нэг хуудсанд</span>
          <select
            value={size}
            onChange={(e) => go(hrefFor({ size: Number(e.target.value), page: 1 }))}
            className="h-8 rounded-lg border border-slate-300 bg-white pl-2 pr-7 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-900"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} мөр
              </option>
            ))}
          </select>
        </label>
      </div>
    </nav>
  );
}

/**
 * Хуудасны холбоос. `<a href>` хэвээр — шинэ табд нээх, баруун товчоор
 * хуулах боломжтой. Энгийн дарахад transition-оор шилжиж, хүлээх үед
 * хуудаслалт бүдгэрнэ.
 */
function PageLink({
  href,
  disabled = false,
  current = false,
  onGo,
  label,
  className,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  onGo: (href: string) => void;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={(e) => {
        // Шинэ таб (Ctrl/⌘, дунд товч) — хөтөчид нь үлдээнэ
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (!disabled && !current) onGo(href);
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
