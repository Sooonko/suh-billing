'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, NavIcon, isNavActive } from './nav-items';

/**
 * Доод талын цэс — ЗӨВХӨН гар утсан дээр (md-ээс доош).
 *
 * Хэрэглэгчийн ~60% гар утаснаас ханддаг тул цэсийг доод талд, хуруу хүрэхэд
 * хялбар өндөртэй тавьсан. Веб дээр толгойн цэс (TopNav) орлоно.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Үндсэн цэс"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map((item) => {
          const { href, label, icon } = item;
          const staff = 'staff' in item && item.staff;
          const active = isNavActive(pathname, href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[11px] font-medium transition ${
                  active
                    ? 'text-slate-900'
                    : staff
                      ? 'text-slate-300 hover:text-slate-500'
                      : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className="[&>svg]:h-6 [&>svg]:w-6">
                  <NavIcon d={icon} active={active} />
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
