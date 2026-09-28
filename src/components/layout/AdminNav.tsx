'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';

/**
 * Админы цэс + хэрэглэгчийн цэс.
 *
 * Оршин суугчийн цэснээс зориуд ӨӨР харагдуулсан (хар дэвсгэр) — админ хаана
 * байгаагаа андуурч, жинхэнэ датад санамсаргүй хүрэхээс сэргийлнэ.
 *
 * ⚠️ И-мэйл, «Сайт», «Гарах» гурвыг унждаг цэс болгосон шалтгаан: цэсний
 * нэрс урт тул гурвуулаа мөрөнд зэрэг багтахгүй, толгой хоёр мөр болж
 * эвдэрч байсан. Өдөр тутам хэрэгтэй нь цэс, эдгээр нь хааяа.
 */
const ITEMS = [
  { href: '/admin', label: 'Хяналт' },
  { href: '/admin/announcements', label: 'Зарлал' },
  { href: '/admin/flats', label: 'Айлууд' },
  // «Төлбөрийн хуулга» ба «Дансны хуулга» хоёр ижил жагсаалтыг харуулдаг
  // байсан тул НЭГ болгов — /admin/payments дотор Жагсаалт / Хуулга
  // оруулах гэсэн таб болов.
  { href: '/admin/payments', label: 'Баримт' },
  { href: '/admin/invoices', label: 'Нэхэмжлэл' },
  { href: '/admin/tariffs', label: 'Тариф' },
] as const;

function UserMenu({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Хэрэглэгчийн цэс"
        className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-sm font-bold uppercase text-white transition hover:bg-white/25"
      >
        {email.charAt(0) || '?'}
      </button>

      {open && (
        <>
          {/* Гадна дарахад хаагдана */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <p className="truncate border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              {email}
            </p>
            <Link
              href="/"
              className="block px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Оршин суугчийн сайт
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              Гарах
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:px-8">
        <span className="shrink-0 text-sm font-bold tracking-tight">СӨХ Админ</span>

        {/* Цэсний нэр урт тул нарийн дэлгэц дээр хэвтээ гүйнэ */}
        <nav aria-label="Админы цэс" className="min-w-0 flex-1">
          <ul className="flex gap-0.5 overflow-x-auto">
            {ITEMS.map(({ href, label }) => {
              // "/admin" бол яг таарсан үед л, бусад нь угтвараар
              const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`block whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${active ? 'bg-white/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0">
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  );
}
