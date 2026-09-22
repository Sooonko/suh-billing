import { formatBillingMonth, formatMnt } from '@/lib/format';
import { ExcelExportButton } from '@/components/admin/filters/ExcelExportButton';
import { FilterField, FilterPanel } from '@/components/admin/filters/FilterPanel';
import { MonthStepper } from '@/components/admin/filters/MonthStepper';
import { ResultSummary } from '@/components/admin/filters/ResultSummary';
import { SearchBox } from '@/components/admin/filters/SearchBox';
import { SegmentedNav } from '@/components/admin/filters/SegmentedNav';
import { WarningChip } from '@/components/admin/filters/WarningChip';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { CATEGORIES, CATEGORY_LABEL, type BillCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

const STATUS_STYLE: Record<string, string> = {
  MATCHED: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-amber-100 text-amber-900',
  UNMATCHED: 'bg-red-100 text-red-800',
  IGNORED: 'bg-slate-100 text-slate-600',
};

const STATUS_LABEL: Record<string, string> = {
  MATCHED: 'Хуваарилсан',
  PARTIAL: 'Дутуу',
  UNMATCHED: 'Хуваарилаагүй',
  IGNORED: 'Тооцохгүй',
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
  searchParams: Promise<{ category?: string; status?: string; q?: string; month?: string }>;
}) {
  const params = await searchParams;
  const category = CATEGORY_KEYS.includes(params.category as BillCategory)
    ? (params.category as BillCategory)
    : null;
  const status = ['MATCHED', 'PARTIAL', 'UNMATCHED'].includes(params.status ?? '')
    ? params.status!
    : null;
  const search = params.q?.trim() ?? '';
  // 'YYYY-MM' — тухайн сард ХИЙГДСЭН гүйлгээ. Хоосон бол бүх хугацаа.
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? '') ? params.month! : '';

  const db = createAdminClient();

  let query = db
    .from('transactions')
    .select(
      'id, txn_date, amount, description, source_category, status, parsed_flat_number, allocations(amount, category, flats(flat_number, owner_name))',
    )
    .order('txn_date', { ascending: false })
    .limit(1000);

  if (category) query = query.eq('source_category', category);
  if (status) query = query.eq('status', status);
  if (month) {
    // Сарын эхнээс дараа сарын эхэн хүртэл
    const [y, m] = month.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    query = query.gte('txn_date', `${month}-01`).lt('txn_date', next);
  }

  const [{ data }, allDates] = await Promise.all([
    query,
    // Сарын сонголт БҮТЭН байх ёстой — дутвал хуучин сар цэснээс алга болно
    fetchAllRows<{ txn_date: string }>((from, to) =>
      db.from('transactions').select('txn_date').range(from, to),
    ),
  ]);

  // Гүйлгээ орсон сарууд — шүүлтүүрийн сонголт
  const months = [
    ...new Set((allDates ?? []).map((r) => String(r.txn_date).slice(0, 7))),
  ].sort((a, b) => b.localeCompare(a));

  type Row = {
    id: string;
    txn_date: string;
    amount: number;
    description: string;
    source_category: BillCategory;
    status: string;
    parsed_flat_number: number | null;
    allocations: { amount: number; category: BillCategory; flat: string }[];
  };

  let rows: Row[] = (data ?? []).map((t) => ({
    id: t.id as string,
    txn_date: t.txn_date as string,
    amount: Number(t.amount),
    description: t.description as string,
    source_category: t.source_category as BillCategory,
    status: t.status as string,
    parsed_flat_number: t.parsed_flat_number as number | null,
    allocations: ((t.allocations ?? []) as unknown as {
      amount: number;
      category: BillCategory;
      flats: { flat_number: number; owner_name: string | null } | null;
    }[]).map((a) => ({
      amount: Number(a.amount),
      category: a.category,
      flat: a.flats ? String(a.flats.flat_number) : '—',
    })),
  }));

  if (search) {
    const needle = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.description.toLowerCase().includes(needle) ||
        r.allocations.some((a) => a.flat.includes(needle)),
    );
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const allocated = rows.reduce((s, r) => s + r.allocations.reduce((x, a) => x + a.amount, 0), 0);

  /** Шүүлт солиход бусад параметрийг хэвээр авч явах URL */
  const hrefWith = (patch: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(month ? { month } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(search ? { q: search } : {}),
    });
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `/admin/payments?${next}`;
  };

  // Хуваарилагдаагүй / дутуу хуваарилсан гүйлгээ — эдгээр мөнгө айлын
  // үлдэгдэлд ТУСААГҮЙ байна, тиймээс админ гараар шийдэх ёстой
  const unmatched = rows.filter((r) => r.status === 'UNMATCHED').length;
  const partial = rows.filter((r) => r.status === 'PARTIAL').length;

  const exportHeaders = ['Огноо', 'Дүн', 'Гүйлгээний утга', 'Оногдсон тоот', 'Данс', 'Төлөв'];
  const exportRows: (string | number | null)[][] = rows.map((r) => [
    r.txn_date,
    r.amount,
    r.description,
    r.allocations.map((a) => a.flat).join(', ') || '—',
    CATEGORY_LABEL[r.source_category] ?? r.source_category,
    r.status,
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Дансны хуулга
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Банкны хуулгаас орсон гүйлгээ бүр хэнд оногдсон бэ.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Гүйлгээ</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{rows.length}</p>
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
            filename={`Хуулга ${month ?? 'бүх хугацаа'}`}
            sheetName="Хуулга"
            headers={exportHeaders}
            rows={exportRows}
          />
        }
      >
        <FilterField label="Сар">
          <MonthStepper months={months} current={month} allowAll allLabel="Бүх хугацаа" />
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
          <SearchBox placeholder="Тоот эсвэл гүйлгээний утга" initial={search} />
        </FilterField>
      </FilterPanel>

      <ResultSummary
        scope={`${month ? formatBillingMonth(month) : 'Бүх хугацаа'} · ${
          category ? CATEGORY_LABEL[category].toLowerCase() : 'бүх данс'
        }${search ? ` · «${search}»` : ''}`}
        count={rows.length}
        unit="гүйлгээ"
      >
        <WarningChip count={unmatched} label="гүйлгээ хуваарилаагүй" />
        <WarningChip count={partial} label="гүйлгээ дутуу хуваарилсан" />
      </ResultSummary>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          Гүйлгээ олдсонгүй.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[40rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-medium">Огноо</th>
                  <th className="px-3 py-2 text-right font-medium">Дүн</th>
                  <th className="px-3 py-2 text-left font-medium">Гүйлгээний утга</th>
                  <th className="px-3 py-2 text-left font-medium">Оногдсон</th>
                  <th className="px-3 py-2 text-left font-medium">Данс</th>
                  <th className="px-3 py-2 text-left font-medium">Төлөв</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-baseline justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-600">{rows.length} гүйлгээ</span>
            <span className="text-lg font-bold tabular-nums text-slate-900">{formatMnt(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
