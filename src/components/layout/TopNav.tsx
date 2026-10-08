'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NewsStamp } from '@/lib/news-seen';
import { NAV_ITEMS, NavIcon, isNavActive } from './nav-items';
import { NewsBadge } from './NewsBadge';

/**
 * Толгойн хэвтээ цэс — ЗӨВХӨН веб дээр (md-ээс дээш).
 *
 * Хэрэглэгчийн ~40% компьютерээс ханддаг. Тэнд доод талын цэс эвгүй тул
 * толгойд нь хэвтээ болгож гаргав.
 */
export function TopNav({ newsStamps }: { newsStamps: NewsStamp[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Үндсэн цэс" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const { href, label, icon } = item;
          const staff = 'staff' in item && item.staff;
          const active = isNavActive(pathname, href);

          return (
            <li key={href} className={staff ? 'ml-2 border-l border-slate-200 pl-3' : undefined}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-100 text-slate-900'
                    : staff
                      ? 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="relative inline-flex">
                  <NavIcon d={icon} active={active} />
                  {href === '/' && <NewsBadge stamps={newsStamps} className="absolute -right-2 -top-1.5" />}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
