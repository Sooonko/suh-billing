'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CATEGORIES, type BillCategory, type ResidentDashboardData } from '@/lib/types';
import { hasDebt as isOwing } from '@/lib/money';
import { BalanceSummary } from './BalanceSummary';
import { CategoryCard } from './CategoryCard';
import { DebtBreakdown } from './DebtBreakdown';
import { PaymentList } from './PaymentList';

/**
 * Оршин суугчийн үндсэн дэлгэц.
 *
 * Хураангуйг дээр тавьсан шалтгаан: "би хэд төлөх ёстой вэ?" гэдэг нь
 * оршин суугчийн 90% асуулт. Түүнийг таб дарахгүйгээр харуулна
 * (`BalanceSummary` — ангилал бүр том, нийт нь жижиг).
 *
 * Байршуулалт хоёр өөр:
 *  · Гар утас (lg-ээс доош) — 3 таб, нэг удаад нэг ангилал
 *  · Веб      (lg-ээс дээш) — 3 ангилал ЗЭРЭГЦЭЭ, таб шаардлагагүй
 */
export function ResidentDashboard({ data }: { data: ResidentDashboardData }) {
  const [active, setActive] = useState<BillCategory>('WATER_HEAT');

  // Ангилал бүрийг түлхүүрээр нь шууд олж авахын тулд Map болгоно
  const byCategory = new Map(data.categories.map((c) => [c.category, c]));
  const activeState = byCategory.get(active);
  const activeMeta = CATEGORIES.find((c) => c.key === active)!;

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3 md:mb-7">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 md:text-sm">Тоот</p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
            {data.flatNumber}
          </h1>
          {data.ownerName && (
            <p className="mt-0.5 truncate text-sm text-slate-600 md:text-base">{data.ownerName}</p>
          )}
        </div>

        <Link
          href="/tolbor"
          className="mt-1 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 md:px-4 md:py-2 md:text-sm"
        >
          Тоот солих
        </Link>
      </header>

      {/* ── Хураангуй: ангилал бүр том, нийт нь жижиг ─────────────────────── */}
      <BalanceSummary byCategory={byCategory} debts={data.debts} onSelect={setActive} />

      {/* Аль сараас хойш өртэй вэ */}
      <DebtBreakdown debts={data.debts} />

      {/* ── Гар утас: таб + нэг карт ──────────────────────────────────────── */}
      <div className="lg:hidden">
        <div
          role="tablist"
          aria-label="Төлбөрийн ангилал"
          className="mb-4 flex rounded-xl bg-slate-100 p-1"
        >
          {CATEGORIES.map(({ key, label }) => {
            const isActive = key === active;
            const state = byCategory.get(key);
            // Өртэй ангилал дээр улаан цэг тавьж анхаарал татна
            const hasDebt = state !== undefined && isOwing(Number(state.balance));

            return (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActive(key)}
                className={`relative flex-1 rounded-lg px-2 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {label}
                {hasDebt && (
                  <span
                    aria-label="төлбөртэй"
                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div role="tabpanel">
          {activeState ? (
            <CategoryCard
              state={activeState}
              hasMeter={activeMeta.hasMeter}
              flatNumber={data.flatNumber}
              account={data.accounts?.[activeState.category]}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-500">
              Мэдээлэл олдсонгүй.
            </div>
          )}
        </div>
      </div>

      {/* ── Веб: 3 ангилал зэрэгцээ ───────────────────────────────────────── */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-3 lg:grid-rows-[auto_auto]">
        {CATEGORIES.map(({ key, label, hasMeter }) => {
          const state = byCategory.get(key);
          return state ? (
            <CategoryCard
              key={key}
              state={state}
              hasMeter={hasMeter}
              label={label}
              flatNumber={data.flatNumber}
              account={data.accounts?.[key]}
            />
          ) : (
            <div
              key={key}
              className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-500 lg:row-span-2"
            >
              {label} — мэдээлэл олдсонгүй.
            </div>
          );
        })}
      </div>

      {/* Төлсөн түүх — хүснэгт хэлбэрээр */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Төлсөн түүх</h2>
        <PaymentList payments={data.payments} />
      </section>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400 md:mt-8 md:text-sm">
        Төлбөрийн зөрүү байвал{' '}
        <Link href="/holboo" className="underline decoration-slate-300">
          СӨХ-тэй холбогдоно уу
        </Link>
        .
      </p>
    </div>
  );
}
