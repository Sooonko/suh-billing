import { BottomNav } from '@/components/layout/BottomNav';
import { TopNav } from '@/components/layout/TopNav';
import { SOH } from '@/lib/soh-config';

/**
 * Бүх дэлгэцийн бүрхүүл.
 *
 * Хоёр өөр хэлбэр:
 *  · Гар утас (~60%) — нарийн багана + ДООД цэс
 *  · Веб      (~40%) — өргөн багана + ТОЛГОЙН цэс, том фонт
 *
 * Агуулгад pb-24 өгсөн нь доод цэс контентыг дарахгүйн тулд. Веб дээр доод
 * цэс байхгүй тул md:pb-12 болж багасна.
 */
export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-3.5 md:max-w-6xl md:px-8 md:py-4">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white md:h-10 md:w-10"
          >
            P-A
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900 md:text-base">
              {SOH.name}
            </p>
            <p className="truncate text-xs leading-tight text-slate-500 md:text-sm">{SOH.tagline}</p>
          </div>

          {/* Веб дээрх хэвтээ цэс — баруун зах руу түлхэнэ */}
          <div className="ml-auto">
            <TopNav />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-5 md:max-w-6xl md:px-8 md:pb-12 md:pt-8">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
