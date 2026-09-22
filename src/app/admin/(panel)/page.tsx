import Link from 'next/link';
import { formatMnt } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { CATEGORIES, type BillCategory } from '@/lib/types';

/** Админ дата бичих тул кэшлэхгүй — үргэлж шинэ тоо харуулна */
export const dynamic = 'force-dynamic';

/**
 * Админы хяналтын самбар.
 *
 * Гол зорилго: «одоо ямар ажил хийх ёстой вэ?» ба «төлбөр хэр цуглаж
 * байна?» гэдгийг нэг харцаар хэлэх.
 */

interface CategorySummary {
  category: BillCategory;
  billed: number;
  paid: number;
  /** Зөвхөн ЭЕРЭГ үлдэгдлийн нийлбэр — цуглуулах ёстой жинхэнэ өр */
  debt: number;
  /** Сөрөг үлдэгдлийн нийлбэр (үнэмлэхүй) — илүү төлөлт */
  overpaid: number;
  debtors: number;
}

async function loadStats() {
  const db = createAdminClient();

  const count = async (table: string, apply?: (q: any) => any) => {
    let q = db.from(table).select('*', { count: 'exact', head: true });
    if (apply) q = apply(q);
    const { count: c } = await q;
    return c ?? 0;
  };

  const [flats, unmatched, partial, txns, balances] = await Promise.all([
    count('flats', (q) => q.eq('is_active', true)),
    count('transactions', (q) => q.eq('status', 'UNMATCHED')),
    count('transactions', (q) => q.eq('status', 'PARTIAL')),
    count('transactions'),
    // PostgREST-ийн 1000 мөрийн хязгаараас хамгаалж хуудаслана
    fetchAllRows<{
      category: string;
      total_billed: number;
      total_paid: number;
      balance: number;
    }>((from, to) =>
      db
        .from('v_flat_balances')
        .select('category, total_billed, total_paid, balance')
        .range(from, to),
    ),
  ]);

  const empty = (): Omit<CategorySummary, 'category'> => ({
    billed: 0,
    paid: 0,
    debt: 0,
    overpaid: 0,
    debtors: 0,
  });
  const byCategory = new Map<BillCategory, Omit<CategorySummary, 'category'>>();

  for (const row of balances) {
    const category = row.category as BillCategory;
    const acc = byCategory.get(category) ?? empty();
    const balance = Number(row.balance);

    acc.billed += Number(row.total_billed);
    acc.paid += Number(row.total_paid);
    // Өр ба илүү төлөлтийг ХОЛИХГҮЙ — нэгийг нөгөөгөөр нөхөх нь
    // цуглуулах ёстой дүнг далдалдаг
    if (balance > 0) {
      acc.debt += balance;
      acc.debtors++;
    } else if (balance < 0) {
      acc.overpaid += -balance;
    }
    byCategory.set(category, acc);
  }

  const summary: CategorySummary[] = CATEGORIES.map(({ key }) => ({
    category: key,
    ...(byCategory.get(key) ?? empty()),
  }));

  return { flats, needsWork: unmatched + partial, txns, summary };
}

function StatCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${
        warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1.5 text-3xl font-bold tabular-nums tracking-tight ${
          warn ? 'text-amber-900' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const { flats, needsWork, txns, summary } = await loadStats();

  const total = summary.reduce(
    (acc, row) => ({
      billed: acc.billed + row.billed,
      paid: acc.paid + row.paid,
      debt: acc.debt + row.debt,
      overpaid: acc.overpaid + row.overpaid,
    }),
    { billed: 0, paid: 0, debt: 0, overpaid: 0 },
  );

  /** Хэдэн хувийг цуглуулсан бэ */
  const collected = total.billed > 0 ? Math.round((total.paid / total.billed) * 100) : 0;
  const hasOverpaid = summary.some((row) => row.overpaid > 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Хяналтын самбар</h1>

      {/* ── Ажлын төлөв ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Гар шалгалт"
          value={String(needsWork)}
          hint="тоот таагдаагүй / дутуу хуваарилсан гүйлгээ"
          warn={needsWork > 0}
        />
        <StatCard label="Бүртгэлтэй тоот" value={String(flats)} />
        <StatCard label="Гүйлгээ" value={String(txns)} hint="хуулгаас оруулсан" />
      </div>

      {/* ── Төлбөрийн байдал ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Төлбөрийн байдал</h2>
          <span className="text-sm text-slate-500">
            Цуглуулсан{' '}
            <span className="font-bold tabular-nums text-emerald-700">{collected}%</span>
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium">Ангилал</th>
                <th className="px-3 py-2.5 text-right font-medium">Нэхэмжилсэн</th>
                <th className="px-3 py-2.5 text-right font-medium">Төлсөн</th>
                <th className="px-3 py-2.5 text-right font-medium">Үлдсэн өр</th>
                {hasOverpaid && (
                  <th className="px-3 py-2.5 text-right font-medium">Илүү төлөлт</th>
                )}
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
                  Өртэй айл
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {summary.map((row) => {
                const meta = CATEGORIES.find((c) => c.key === row.category)!;
                return (
                  <tr key={row.category} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{meta.label}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {row.billed === 0 ? '—' : formatMnt(row.billed)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-emerald-700">
                      {row.paid === 0 ? '—' : formatMnt(row.paid)}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-red-700">
                      {row.debt === 0 ? '—' : formatMnt(row.debt)}
                    </td>
                    {hasOverpaid && (
                      <td className="px-3 py-3 text-right tabular-nums text-blue-700">
                        {row.overpaid === 0 ? '—' : formatMnt(row.overpaid)}
                      </td>
                    )}
                    <td className="hidden px-4 py-3 text-right tabular-nums text-slate-500 sm:table-cell">
                      {row.debtors === 0 ? '—' : `${row.debtors} / ${flats}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-900">Нийт</td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-900">
                  {formatMnt(total.billed)}
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700">
                  {formatMnt(total.paid)}
                </td>
                <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-red-700">
                  {formatMnt(total.debt)}
                </td>
                {hasOverpaid && (
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-blue-700">
                    {formatMnt(total.overpaid)}
                  </td>
                )}
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          «Нэхэмжилсэн» нь бүх сарын нийлбэр. «Үлдсэн өр» нь өртэй айлуудын дүн — илүү
          төлөлттэйг нөхөж хасаагүй, тиймээс цуглуулах ёстой жинхэнэ дүн.
        </p>
      </section>

      {/* ── Шуурхай үйлдэл ──────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            href: '/admin/announcements',
            icon: '📣',
            title: 'Зарлал нэмэх',
            text: 'Оршин суугчийн эхний дэлгэц дээр гарах мэдээ, зарлал',
          },
          {
            href: '/admin/invoices?tab=import',
            icon: '🧾',
            title: 'Нэхэмжлэл оруулах',
            text: 'Сарын тооцооны Excel, эсвэл СӨХ-ийн хураамж',
          },
          {
            href: '/admin/reconcile',
            icon: '🏦',
            title: 'Хуулга тулгах',
            text: 'Банкны хуулгын Excel — автомат тоот таналт',
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <p className="text-2xl" aria-hidden>
              {card.icon}
            </p>
            <p className="mt-2 font-semibold text-slate-900">{card.title}</p>
            <p className="mt-1 flex-1 text-sm text-slate-500">{card.text}</p>
            <span
              aria-hidden
              className="mt-3 text-sm text-slate-400 transition group-hover:translate-x-0.5"
            >
              Нээх →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
