'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatMnt } from '@/lib/format';
import { CATEGORIES, type BillCategory, type ResidentDashboardData } from '@/lib/types';
import { settledBalance, hasDebt as isOwing } from '@/lib/money';
import { CategoryCard } from './CategoryCard';
import { DebtBreakdown } from './DebtBreakdown';
import { PaymentList } from './PaymentList';

/**
 * Оршин суугчийн үндсэн дэлгэц.
 *
 * Хураангуйг дээр тавьсан шалтгаан: "би хэд төлөх ёстой вэ?" гэдэг нь
 * оршин суугчийн 90% асуулт. Түүнийг таб дарахгүйгээр харуулна.
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

  /**
   * Нийт төлөх дүн — ЗӨВХӨН өртэй ангиллуудын нийлбэр.
   *
   * ⚠️ ИЛҮҮ ТӨЛӨЛТИЙГ ХАСАХГҮЙ. Ангилал бүр ӨӨР ДАНСТАЙ тул оршин суугч
   * цахилгааны илүү төлөлтөөрөө ус дулааны өрөө хаах боломжгүй. Өмнө нь
   * хасдаг байсан тул 107 тоот «40,150₮ ус дулаанд өртэй, 38,574₮
   * цахилгаанд илүү» байхад «нийт төлөх 1,576₮» гэж худал харуулсан —
   * тэр хүн 40,150₮ шилжүүлэх ёстой.
   *
   * 50₮-өөс бага үлдэгдэл нь аравтын бөөрөнхийллийн үлдэц (money.ts).
   */
  const balances = data.categories.map((c) => settledBalance(Number(c.balance)));
  const total = balances.reduce((sum, b) => (b > 0 ? sum + b : sum), 0);
  /** Илүү төлөлт ТУСАД НЬ — дараагийн сард зарцуулагдана */
  const overpaid = balances.reduce((sum, b) => (b < 0 ? sum - b : sum), 0);

  /** Үлдэгдлийн тэмдгээс хамаарсан өнгө — нэг эх сурвалжаас удирдана */
  const tone = (value: number) =>
    value > 0 ? 'text-red-700' : value < 0 ? 'text-blue-700' : 'text-emerald-700';

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

      {/* ── Хураангуй: нийт дүн + 3 ангиллын зэрэгцүүлэл ─────────────────── */}
      <section
        aria-label="Төлбөрийн хураангуй"
        className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:mb-7 md:flex md:items-stretch"
      >
        <div className="px-5 pb-4 pt-5 md:flex-1 md:px-7 md:py-7">
          <p className="text-sm font-medium text-slate-500 md:text-base">
            {total > 0 ? 'Нийт төлөх дүн' : overpaid > 0 ? 'Нийт илүү төлсөн' : 'Төлбөрийн үлдэгдэл'}
          </p>
          <p
            className={`mt-1 text-4xl font-bold tabular-nums tracking-tight md:text-5xl ${total > 0 ? 'text-red-700' : overpaid > 0 ? 'text-blue-700' : 'text-emerald-700'
              }`}
          >
            {formatMnt(total > 0 ? total : overpaid)}
          </p>
          {total === 0 && overpaid === 0 && (
            <p className="mt-1 text-sm text-emerald-700 md:text-base">Бүх төлбөр цэвэр байна 🎉</p>
          )}
          {/*
            Өртэй БА илүү төлсөн зэрэг байж болно — данс тусдаа учраас.
            Илүүг нь дурдахгүй бол «би илүү төлсөн шүү дээ» гэж эргэлзэнэ.
          */}
          {total > 0 && overpaid > 0 && (
            <p className="mt-1.5 text-sm text-blue-700 md:text-base">

            </p>
          )}
        </div>

        {/*
          Гар утсан дээр дарвал тухайн таб руу шилжинэ. Веб дээр 3 карт хэдийнэ
          зэрэгцэж харагддаг тул дарах шаардлагагүй → pointer-events унтраана.
        */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 md:w-80 md:shrink-0 md:border-l md:border-t-0">
          {CATEGORIES.map(({ key, label }) => {
            const balance = settledBalance(Number(byCategory.get(key)?.balance ?? 0));
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className="px-2 py-3 text-center transition hover:bg-slate-50 md:py-5 lg:pointer-events-none lg:cursor-default lg:hover:bg-transparent"
              >
                <p className="truncate text-[11px] leading-tight text-slate-400 md:text-xs">{label}</p>
                <p className={`mt-1 text-sm font-bold tabular-nums md:text-base ${tone(balance)}`}>
                  {formatMnt(balance)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

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
