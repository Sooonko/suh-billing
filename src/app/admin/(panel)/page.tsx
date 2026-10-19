import Link from 'next/link';
import { TransferLedgerImport } from '@/components/admin/TransferLedgerImport';
import { formatBillingMonth, formatMnt } from '@/lib/format';
import { hasDebt, hasOverpaid } from '@/lib/money';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { RECIPIENT_LABEL, RECIPIENTS, type TransferRecipient } from '@/lib/transfers';
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
    // 50₮-өөс бага зөрүү — төлөх боломжгүй тул өр ч биш, илүү ч биш
    if (hasDebt(balance)) {
      acc.debt += balance;
      acc.debtors++;
    } else if (hasOverpaid(balance)) {
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

interface TransferRow {
  recipient: TransferRecipient;
  transfer_date: string;
  amount: number;
  description: string | null;
  note: string | null;
}

/**
 * Улсын байгууллага руу шилжүүлсэн мөнгө.
 *
 * Хүснэгт үүсээгүй (schema.sql-ийг дахин ажиллуулаагүй) бол null — самбар
 * бүхэлдээ унахгүй, зөвхөн энэ хэсэг сануулга харуулна.
 */
async function loadTransfers(): Promise<TransferRow[] | null> {
  const db = createAdminClient();
  try {
    return await fetchAllRows<TransferRow>((from, to) =>
      db
        .from('utility_transfers')
        .select('recipient, transfer_date, amount, description, note')
        .order('transfer_date', { ascending: false })
        .order('id')
        .range(from, to),
    );
  } catch {
    return null;
  }
}

const sumOf = (items: TransferRow[]) => items.reduce((acc, t) => acc + Number(t.amount), 0);

/** Сар бүрт шууд харагдах тоо — үүнээс хуучныг нэг хураасан хэсэгт */
const VISIBLE_MONTHS = 12;

/** Сарын мөр болон толгойн багана — нэг загвар, тэгш зэрэгцэнэ */
const MONTH_GRID = 'grid grid-cols-[1fr_auto] items-center gap-x-4 sm:grid-cols-[10rem_repeat(3,minmax(0,1fr))_8rem]';

/** Нэг сарын мөр — дарахад тухайн сарын шилжүүлгүүд хүлээн авагчаар нээгдэнэ */
function MonthRow({ month, items }: { month: string; items: TransferRow[] }) {
  return (
    <details className="group border-t border-slate-100 first:border-t-0">
      <summary className={`${MONTH_GRID} cursor-pointer list-none px-4 py-3 hover:bg-slate-50 [&::-webkit-details-marker]:hidden`}>
        <span className="font-medium text-slate-900">
          <span className="mr-1.5 inline-block text-slate-400 transition group-open:rotate-90">›</span>
          {formatBillingMonth(month)}
        </span>
        {RECIPIENTS.map(({ key }) => {
          const list = items.filter((t) => t.recipient === key);
          return (
            <span key={key} className="hidden text-right tabular-nums sm:block">
              {list.length ? (
                <>
                  <span className="text-slate-800">{formatMnt(sumOf(list))}</span>
                  <span className="block text-[11px] text-slate-400">{list.length} удаа</span>
                </>
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </span>
          );
        })}
        <span className="text-right font-bold tabular-nums text-slate-900">{formatMnt(sumOf(items))}</span>
      </summary>

      <div className="grid gap-4 bg-slate-50/70 px-4 py-3 sm:grid-cols-3">
        {RECIPIENTS.map(({ key }) => {
          // Сарын дотор огноогоор өсөхөөр — хуулгатай тулгахад амар
          const list = items
            .filter((t) => t.recipient === key)
            .sort((a, b) => a.transfer_date.localeCompare(b.transfer_date));
          if (!list.length) return null;
          return (
            <div key={key}>
              <p className="flex justify-between border-b border-slate-200 pb-1 text-xs font-semibold text-slate-600">
                <span>{RECIPIENT_LABEL[key]}</span>
                <span className="tabular-nums">{formatMnt(sumOf(list))}</span>
              </p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {list.map((t, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="tabular-nums text-slate-500">
                      {Number(t.transfer_date.slice(5, 7))}/{Number(t.transfer_date.slice(8, 10))}
                      {t.note && (
                        <span className="ml-1.5 rounded bg-indigo-100 px-1 text-[10px] font-medium text-indigo-800" title={t.note}>
                          тэмдэглэлтэй
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-slate-800">{formatMnt(Number(t.amount))}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function TransfersSection({ transfers }: { transfers: TransferRow[] | null }) {
  if (transfers === null) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Улсын байгууллагад шилжүүлсэн</h2>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          utility_transfers хүснэгт олдсонгүй. Supabase SQL Editor дээр supabase/schema.sql-ийг дахин
          ажиллуулна уу.
        </p>
      </section>
    );
  }

  const totals = RECIPIENTS.map(({ key }) => {
    const list = transfers.filter((t) => t.recipient === key);
    return {
      key,
      count: list.length,
      total: sumOf(list),
      // Тэмдэглэлтэй хэсэг (Орхоны шугуйн өр г.м) — нийтэд ОРСОН, тусад нь харуулна
      notes: [...new Set(list.map((t) => t.note).filter(Boolean))].map((note) => ({
        note: note as string,
        amount: sumOf(list.filter((t) => t.note === note)),
      })),
      last: list[0]?.transfer_date ?? null,
    };
  });
  const total = sumOf(transfers);

  // Сараар бүлэглэнэ — шинэ нь эхэндээ (transfers аль хэдийн огноогоор буурсан)
  const byMonth = new Map<string, TransferRow[]>();
  for (const t of transfers) {
    const month = t.transfer_date.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), t]);
  }
  const months = [...byMonth.entries()];
  const recent = months.slice(0, VISIBLE_MONTHS);
  const older = months.slice(VISIBLE_MONTHS);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Улсын байгууллагад шилжүүлсэн</h2>
        <span className="text-sm text-slate-500">
          Нийт <span className="font-bold tabular-nums text-slate-900">{formatMnt(total)}</span>
          {transfers.length > 0 && ` · ${transfers.length} гүйлгээ`}
        </span>
      </div>

      {/* ── Хүлээн авагч бүрийн нийт ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {totals.map((row) => (
          <div key={row.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{RECIPIENT_LABEL[row.key]}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
              {row.total === 0 ? '—' : formatMnt(row.total)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {row.count} гүйлгээ{row.last && ` · сүүлд ${row.last}`}
            </p>
            {row.notes.map((n) => (
              <p key={n.note} className="mt-2 rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-800">
                үүнээс {n.note}: <span className="font-semibold tabular-nums">{formatMnt(n.amount)}</span>
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* ── Сараар ── */}
      {months.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div
            className={`${MONTH_GRID} border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500`}
          >
            <span>Сар</span>
            {RECIPIENTS.map(({ key }) => (
              <span key={key} className="hidden text-right sm:block">
                {RECIPIENT_LABEL[key].replace(/\s*\(.*\)/, '')}
              </span>
            ))}
            <span className="text-right">Нийт</span>
          </div>

          {recent.map(([month, items]) => (
            <MonthRow key={month} month={month} items={items} />
          ))}

          {older.length > 0 && (
            <details className="border-t border-slate-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Өмнөх {older.length} сар
              </summary>
              {older.map(([month, items]) => (
                <MonthRow key={month} month={month} items={items} />
              ))}
            </details>
          )}
        </div>
      )}

      <TransferLedgerImport />
    </section>
  );
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
  const [{ flats, needsWork, txns, summary }, transfers] = await Promise.all([loadStats(), loadTransfers()]);

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

      <TransfersSection transfers={transfers} />

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
