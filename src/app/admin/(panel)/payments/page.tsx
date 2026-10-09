import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { formatBillingMonth, formatMnt } from '@/lib/format';
import { AddPayment } from '@/components/admin/AddPayment';
import { PaymentActions } from '@/components/admin/PaymentActions';
import { ReallocateButton } from '@/components/admin/ReallocateButton';
import { ReconcileImport } from '@/components/admin/ReconcileImport';
import { ReparseButton } from '@/components/admin/ReparseButton';
import { ExcelExportButton } from '@/components/admin/filters/ExcelExportButton';
import { FilterField, FilterPanel } from '@/components/admin/filters/FilterPanel';
import { MonthStepper } from '@/components/admin/filters/MonthStepper';
import { Pagination } from '@/components/admin/filters/Pagination';
import { ResultSummary } from '@/components/admin/filters/ResultSummary';
import { SearchBox } from '@/components/admin/filters/SearchBox';
import { SegmentedNav } from '@/components/admin/filters/SegmentedNav';
import { WarningChip } from '@/components/admin/filters/WarningChip';
import {
  loadPaymentIndex,
  loadPaymentRows,
  parsePaymentFilters,
  STATUS_LABEL,
} from '@/lib/admin/payments-query';
import { DEFAULT_PAGE_SIZE, pageInfo, parsePaging } from '@/lib/pagination';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { CATEGORIES, CATEGORY_LABEL, type BankAccount } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Гүйлгээ орсон сарууд — сарын сонголтод.
 *
 * ЯАГААД КЭШЛЭВ: өмнө нь хуудас нээгдэх БҮРТ бүх гүйлгээний огноог
 * (мянга мянган мөр) татдаг байв — хуудас удаан байсан гол шалтгааны
 * нэг. Шинэ гүйлгээ орох үед (`/api/admin/payments`, хуулга импорт)
 * `revalidateTag('transactions')` дуудагдаж кэш шинэчлэгдэнэ.
 */
const loadTxnMonths = unstable_cache(
  async () => {
    const db = createAdminClient();
    const rows = await fetchAllRows<{ txn_date: string }>((from, to) =>
      db.from('transactions').select('txn_date').order('id').range(from, to),
    );
    return [...new Set(rows.map((r) => String(r.txn_date).slice(0, 7)))].sort((a, b) =>
      b.localeCompare(a),
    );
  },
  // Хэлбэр өөрчлөгдвөл хувилбарыг ахиулна — invoices/page.tsx-ийн тайлбарыг үз
  ['txn-months', 'v1'],
  { tags: ['transactions'], revalidate: 600 },
);

const STATUS_STYLE: Record<string, string> = {
  MATCHED: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-amber-100 text-amber-900',
  UNMATCHED: 'bg-red-100 text-red-800',
  IGNORED: 'bg-slate-100 text-slate-600',
};

/**
 * Оруулсан банкны хуулгын жагсаалт.
 *
 * Гүйлгээ бүр хэний төлбөр болж оногдсоныг харуулна. allocations нь нэг
 * гүйлгээг олон айлд хуваах боломжтой тул мөр бүрд бүх хуваарилалтыг
 * жагсаана.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    status?: string;
    q?: string;
    month?: string;
    tab?: string;
    page?: string;
    size?: string;
  }>;
}) {
  const params = await searchParams;
  // Таб нь URL-д — шүүлт, хуудас сэргээхэд алдагдахгүй
  const tab = params.tab === 'import' ? 'import' : 'list';
  const filters = parsePaymentFilters(params);
  const { category, status, month, search } = filters;
  const paging = parsePaging(params);

  const db = createAdminClient();

  // Таб бүр ЗӨВХӨН өөрт хэрэгтэйгээ татна — нөгөө табын хүсэлт дэмий хүлээлгэнэ
  const [index, months, importData] = await Promise.all([
    tab === 'list' ? loadPaymentIndex(db, filters) : Promise.resolve([]),
    tab === 'list' ? loadTxnMonths() : Promise.resolve([] as string[]),
    tab === 'import'
      ? Promise.all([
        // «Хуулга оруулах» табын бөөн үйлдлүүдэд хэрэгтэй
        db.from('bank_accounts').select('id, account_number, category, display_name').order('category'),
        db
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .is('parsed_flat_number', null)
          .eq('status', 'UNMATCHED'),
        db
          .from('v_transactions_remaining')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'UNMATCHED')
          .not('parsed_flat_number', 'is', null),
      ])
      : null,
  ]);

  const accounts = (importData?.[0].data ?? []) as BankAccount[];
  const unmatchedTotal = importData?.[1].count ?? 0;
  const autoFixable = importData?.[2].count ?? 0;

  // Нийт дүн, тоолол — ШҮҮСЭН БҮХ мөрөөр (зөвхөн энэ хуудсаар биш)
  const total = index.reduce((s, r) => s + r.amount, 0);
  const allocated = index.reduce((s, r) => s + (r.amount - r.remaining), 0);

  // Хуваарилагдаагүй / дутуу хуваарилсан гүйлгээ — эдгээр мөнгө айлын
  // үлдэгдэлд ТУСААГҮЙ байна, тиймээс админ гараар шийдэх ёстой
  const unmatched = index.filter((r) => r.status === 'UNMATCHED').length;
  const partial = index.filter((r) => r.status === 'PARTIAL').length;

  // Зөвхөн энэ хуудасны мөрүүдийг бүтнээр нь татна
  const page = pageInfo(index.length, paging);
  const rows = await loadPaymentRows(
    db,
    index.slice(page.from === 0 ? 0 : page.from - 1, page.to).map((r) => r.id),
  );

  /** Шүүлт солиход бусад параметрийг хэвээр авч явах URL. Хуудас 1 рүү буцна. */
  const hrefWith = (patch: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(month ? { month } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(search ? { q: search } : {}),
      // Сонгосон мөрийн тоо шүүлт солиход алдагдахгүй
      ...(paging.size !== DEFAULT_PAGE_SIZE ? { size: String(paging.size) } : {}),
    });
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `/admin/payments?${next}`;
  };

  // Excel-ийг товч ДАРАХАД серверээс татна — мянган мөрийг хуудсанд
  // шингээж явуулбал хуудас удаашрана
  const exportQuery = new URLSearchParams({
    ...(month ? { month } : {}),
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
    ...(search ? { q: search } : {}),
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Баримт</h1>
      <p className="mb-4 text-sm text-slate-500">
        Тухайн оршин айлын хайлт хийж гарч ирсэн дата дээрээ дарж шууд засна.
      </p>

      {/*
        Харах ба оруулах хоёр өөр ажил. Өмнө нь ХОЁР ТУСДАА ЦЭС байсан:
        нэг нь сайн шүүлттэй ч үйлдэлгүй, нөгөө нь үйлдэлтэй ч шүүлтгүй.
        Шинэ хүн хараад ялгааг нь ойлгохгүй байсан тул нэгтгэв.
      */}
      <nav className="mb-6 flex gap-1 border-b border-slate-200">
        {[
          { key: 'list', label: 'Жагсаалт' },
          { key: 'import', label: 'Хуулга оруулах' },
        ].map((item) => (
          <Link
            key={item.key}
            href={`/admin/payments?tab=${item.key}`}
            aria-current={tab === item.key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === item.key
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === 'import' && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-1 text-lg font-bold tracking-tight text-slate-900">
              Банкны хуулга оруулах
            </h2>
            <p className="mb-3 text-sm text-slate-500">
              Excel оруулахад тоотыг автоматаар таньж хуваарилна. Эргэлзээтэйг «Жагсаалт» таб дээр
              «Хуваарилаагүй» төлвөөр шүүж гараар шийднэ.
            </p>
            <ReconcileImport accounts={accounts} />
          </section>

          <section>
            <h2 className="mb-1 text-lg font-bold tracking-tight text-slate-900">Бөөн үйлдэл</h2>
            <p className="mb-3 text-sm text-slate-500">
              Тоот таних дүрэм сайжирсан, эсвэл хуваарилалт гацсан үед хэрэглэнэ.
            </p>
            <ReparseButton count={unmatchedTotal} />
            <ReallocateButton count={autoFixable} />
          </section>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Гүйлгээ</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {index.length.toLocaleString('mn-MN')}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Нийт орлого</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">{formatMnt(total)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Хуваарилсан</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {formatMnt(allocated)}
              </p>
            </div>
          </div>

          {/*
        Данс, төлөв, сар нь дарахад ШУУД шүүнэ. Хайлт л Enter шаардана.
      */}
          <FilterPanel
            action={
              <ExcelExportButton
                filename={`Баримт ${month || 'бүх хугацаа'}`}
                sheetName="Баримт"
                source={`/api/admin/payments/export?${exportQuery}`}
                count={index.length}
              />
            }
          >
            <FilterField label="Сар">
              {/* «Бүх хугацаа» үед month нь '' — сонгогч null хүлээнэ */}
              <MonthStepper months={months} current={month || null} allowAll allLabel="Бүх хугацаа" />
            </FilterField>

            <FilterField label="Данс">
              <SegmentedNav
                items={[
                  { key: 'all', label: 'Бүгд', href: hrefWith({ category: '' }), active: !category },
                  ...CATEGORIES.map((c) => ({
                    key: c.key,
                    label: c.label,
                    href: hrefWith({ category: c.key }),
                    active: c.key === category,
                  })),
                ]}
              />
            </FilterField>

            <FilterField label="Төлөв">
              <SegmentedNav
                items={[
                  { key: 'all', label: 'Бүгд', href: hrefWith({ status: '' }), active: !status },
                  {
                    key: 'MATCHED',
                    label: 'Хуваарилсан',
                    href: hrefWith({ status: 'MATCHED' }),
                    active: status === 'MATCHED',
                  },
                  {
                    key: 'PARTIAL',
                    label: 'Дутуу',
                    href: hrefWith({ status: 'PARTIAL' }),
                    active: status === 'PARTIAL',
                  },
                  {
                    key: 'UNMATCHED',
                    label: 'Хуваарилаагүй',
                    href: hrefWith({ status: 'UNMATCHED' }),
                    active: status === 'UNMATCHED',
                  },
                ]}
              />
            </FilterField>

            <FilterField label="Хайх">
              <SearchBox placeholder="Тоот (яг) эсвэл утга" initial={search} />
            </FilterField>
          </FilterPanel>

          <div className="mb-4 flex justify-end">
            <AddPayment defaultCategory={category ?? undefined} />
          </div>

          {/* Хуудас солиход энд гүйлгэнэ. Наалттай цэсний доор үлдэхгүйн тулд scroll-mt. */}
          <div id="list-top" className="scroll-mt-20" />
          <ResultSummary
            scope={`${month ? formatBillingMonth(month) : 'Бүх хугацаа'} · ${category ? CATEGORY_LABEL[category].toLowerCase() : 'бүх данс'
              }${search ? ` · «${search}»` : ''}`}
            count={index.length}
            unit="гүйлгээ"
          >
            {/* Чип нь «Төлөв» шүүлттэй ижил зүйлийг заадаг — дарвал тэр рүү аваачна */}
            <WarningChip
              count={unmatched}
              label="гүйлгээ хуваарилаагүй"
              href={hrefWith({ status: status === 'UNMATCHED' ? '' : 'UNMATCHED' })}
              active={status === 'UNMATCHED'}
            />
            <WarningChip
              count={partial}
              label="гүйлгээ дутуу хуваарилсан"
              href={hrefWith({ status: status === 'PARTIAL' ? '' : 'PARTIAL' })}
              active={status === 'PARTIAL'}
            />
          </ResultSummary>

          {index.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
              Гүйлгээ олдсонгүй.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* key — хуудас солиход дотоод гүйлгээ эхэндээ буцна */}
              <div key={`${page.page}-${page.size}`} className="max-h-[40rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left font-medium">Огноо</th>
                      <th className="px-3 py-2 text-right font-medium">Дүн</th>
                      <th className="px-3 py-2 text-left font-medium">Гүйлгээний утга</th>
                      <th className="px-3 py-2 text-left font-medium">Оногдсон</th>
                      <th className="px-3 py-2 text-left font-medium">Данс</th>
                      <th className="px-3 py-2 text-left font-medium">Төлөв</th>
                      <th className="px-3 py-2 text-right font-medium">Үйлдэл</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-slate-500">
                          {new Date(row.txn_date).toLocaleDateString('mn-MN')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                          {formatMnt(row.amount)}
                        </td>
                        <td className="max-w-md px-3 py-2">
                          <span className="block truncate text-xs" title={row.description}>
                            {row.description}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {row.allocations.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            row.allocations.map((a, i) => (
                              <span key={i} className="mr-2 inline-block">
                                <span className="font-semibold tabular-nums text-slate-900">
                                  {a.flat}
                                </span>
                                {row.allocations.length > 1 && (
                                  <span className="ml-1 text-xs text-slate-400">
                                    {formatMnt(a.amount)}
                                  </span>
                                )}
                              </span>
                            ))
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                          {CATEGORY_LABEL[row.source_category]}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[row.status] ?? STATUS_STYLE.IGNORED
                              }`}
                          >
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <PaymentActions
                            txn={{
                              id: row.id,
                              txnDate: row.txn_date,
                              amount: row.amount,
                              // Үлдэгдэл = дүн − оногдсон нийлбэр. Оноох маягтын
                              // анхдагч дүн болно.
                              remaining:
                                row.amount - row.allocations.reduce((s, a) => s + a.amount, 0),
                              status: row.status,
                              source_category: row.source_category,
                              parsed_flat_number: row.parsed_flat_number,
                              description: row.description,
                              allocationIds: row.allocations.map((a) => a.id),
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Нийт дүн нь ШҮҮСЭН БҮХ гүйлгээнийх — зөвхөн энэ хуудасных биш */}
              <div className="flex items-baseline justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm text-slate-600">
                  Нийт {index.length.toLocaleString('mn-MN')} гүйлгээ
                </span>
                <span className="text-lg font-bold tabular-nums text-slate-900">{formatMnt(total)}</span>
              </div>

              <Pagination
                page={page.page}
                pageCount={page.pageCount}
                size={page.size}
                total={page.total}
                from={page.from}
                to={page.to}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
