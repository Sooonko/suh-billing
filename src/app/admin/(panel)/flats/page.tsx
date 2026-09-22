import { FlatBalanceList, type FlatBalance } from '@/components/admin/FlatBalanceList';
import { debtForMonth, splitDebtByMonth, type InvoiceLine } from '@/lib/billing/fifo-debt';
import { formatBillingMonth, formatMnt, shortMonth } from '@/lib/format';
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
const EMPTY = { billed: 0, paid: 0, balance: 0 };

/** Шүүлтүүрийн төлөв */
type StateFilter = 'all' | 'debt' | 'paid' | 'over';

const emptyCategories = (): FlatBalance['byCategory'] => ({
  WATER_HEAT: { ...EMPTY },
  SOH: { ...EMPTY },
  ELECTRICITY: { ...EMPTY },
});

/**
 * Айлуудын төлбөрийн жагсаалт.
 *
 * Хоёр хэлбэрээр харна:
 *
 *  · «Бүх сар» — v_flat_balances view-ээс шууд. Хуримтлагдсан өр.
 *  · Тодорхой сар — тэр сард хэн төлөөгүйг FIFO дүрмээр тогтооно.
 *
 * Сарын хэлбэрт ЯАГААД дүрэм хэрэгтэй вэ: банкны гүйлгээ «аль сарын
 * төлбөр» гэдгийг агуулдаггүй (`allocations`-д `billing_month` байхгүй).
 * Тиймээс төлсөн мөнгийг хамгийн хуучин сараас эхлэн зарцуулна. Ингэснээр
 * 9 сарын төлбөрөө 10 сард төлсөн айл «9 сар төлөөгүй» гэж гарахгүй.
 *
 * Тоо нь оршин суугчийн «Өр үүссэн сарууд» хүснэгттэй ижил модуль
 * (`fifo-debt.ts`) хэрэглэдэг тул зөрөх боломжгүй.
 */
export default async function AdminFlatsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; state?: string; q?: string; month?: string }>;
}) {
  const params = await searchParams;
  const category = CATEGORY_KEYS.includes(params.category as BillCategory)
    ? (params.category as BillCategory)
    : null;
  const state: StateFilter = (['debt', 'paid', 'over'] as const).includes(params.state as never)
    ? (params.state as StateFilter)
    : 'all';
  const search = params.q?.trim() ?? '';

  const db = createAdminClient();
  // fetchAllRows — PostgREST нэг хүсэлтэд 1000 мөр л буцаадаг. Нэхэмжлэл
  // сар бүр ~630 мөрөөр өсдөг тул хуудаслахгүй бол тооцоо чимээгүйхэн
  // буруу болно.
  const [flatRows, balanceRows, monthRows] = await Promise.all([
    fetchAllRows<{ id: string; flat_number: number; owner_name: string | null }>((from, to) =>
      db
        .from('flats')
        .select('id, flat_number, owner_name')
        .eq('is_active', true)
        .range(from, to),
    ),
    fetchAllRows<{
      flat_number: number;
      category: string;
      total_billed: number;
      total_paid: number;
      balance: number;
    }>((from, to) =>
      db
        .from('v_flat_balances')
        .select('flat_number, category, total_billed, total_paid, balance')
        .range(from, to),
    ),
    // Зөвхөн нэг багана — сарын сонголтыг гаргахад хэрэгтэй. PostgREST-д
    // DISTINCT байхгүй тул давхардлыг энд арилгана.
    fetchAllRows<{ billing_month: string }>((from, to) =>
      db.from('invoices').select('billing_month').range(from, to),
    ),
  ]);

  const months = [...new Set(monthRows.map((r) => r.billing_month))].sort((a, b) =>
    b.localeCompare(a),
  );
  const month = months.includes(params.month ?? '') ? (params.month as string) : null;

  const nameByFlat = new Map<number, string | null>(
    flatRows.map((f) => [f.flat_number, f.owner_name]),
  );

  const byFlat = new Map<number, FlatBalance>();

  if (month) {
    // ── Сарын хэлбэр: FIFO-гоор тэр сарын үлдэгдлийг гаргана ──────────────
    // FIFO нь БҮХ сарын нэхэмжлэл шаарддаг: төлсөн мөнгөний хэдийг өмнөх
    // сарууд аль хэдийн зарцуулсныг мэдэхгүй бол тооцоо буруу болно.
    const invoiceRows = await fetchAllRows<{
      flat_id: string;
      category: string;
      billing_month: string;
      bill_amount: number;
    }>((from, to) =>
      db
        .from('invoices')
        .select('flat_id, category, billing_month, bill_amount')
        .range(from, to),
    );

    const numberById = new Map<string, number>(
      flatRows.map((f) => [f.id, f.flat_number]),
    );

    const linesByFlat = new Map<number, InvoiceLine[]>();
    for (const row of invoiceRows) {
      const flatNumber = numberById.get(row.flat_id);
      if (flatNumber === undefined) continue; // идэвхгүй болсон тоот
      const list = linesByFlat.get(flatNumber) ?? [];
      list.push({
        month: row.billing_month,
        category: row.category as BillCategory,
        billed: Number(row.bill_amount),
      });
      linesByFlat.set(flatNumber, list);
    }

    const paidByFlat = new Map<number, Map<BillCategory, number>>();
    for (const row of balanceRows) {
      const flatNumber = row.flat_number;
      const map = paidByFlat.get(flatNumber) ?? new Map<BillCategory, number>();
      map.set(row.category as BillCategory, Number(row.total_paid));
      paidByFlat.set(flatNumber, map);
    }

    for (const [flatNumber, lines] of linesByFlat) {
      if (!nameByFlat.has(flatNumber)) continue;

      const picked = debtForMonth(
        splitDebtByMonth(lines, paidByFlat.get(flatNumber) ?? new Map()),
        month,
      );
      if (picked.size === 0) continue; // тэр сард нэхэмжлэл гараагүй тоот

      const entry: FlatBalance = {
        flatNumber,
        ownerName: nameByFlat.get(flatNumber) ?? null,
        byCategory: emptyCategories(),
        totalBilled: 0,
        totalPaid: 0,
        totalBalance: 0,
      };

      for (const [cat, debt] of picked) {
        entry.byCategory[cat] = { billed: debt.billed, paid: debt.paid, balance: debt.remaining };
        entry.totalBilled += debt.billed;
        entry.totalPaid += debt.paid;
        entry.totalBalance += debt.remaining;
      }
      byFlat.set(flatNumber, entry);
    }
  } else {
    // ── Бүх сар: view-ээс шууд, хуримтлагдсан дүн ─────────────────────────
    // v_flat_balances нь view тул flats-тай PostgREST-ээр холбож болохгүй —
    // хоёуланг нь татаад энд нэгтгэнэ. 210 айл × 3 ангилал = 630 мөр, хөнгөн.
    for (const row of balanceRows) {
      const flatNumber = row.flat_number;
      if (!nameByFlat.has(flatNumber)) continue;

      let entry = byFlat.get(flatNumber);
      if (!entry) {
        entry = {
          flatNumber,
          ownerName: nameByFlat.get(flatNumber) ?? null,
          byCategory: emptyCategories(),
          totalBilled: 0,
          totalPaid: 0,
          totalBalance: 0,
        };
        byFlat.set(flatNumber, entry);
      }

      const cell = {
        billed: Number(row.total_billed),
        paid: Number(row.total_paid),
        balance: Number(row.balance),
      };
      entry.byCategory[row.category as BillCategory] = cell;
      entry.totalBilled += cell.billed;
      entry.totalPaid += cell.paid;
      entry.totalBalance += cell.balance;
    }
  }

  let flats = [...byFlat.values()].sort((a, b) => a.flatNumber - b.flatNumber);

  // Шүүлт нь сонгосон ангиллын дүнгээр, эсвэл бүх ангиллын нийлбэрээр
  const valueOf = (f: FlatBalance) => (category ? f.byCategory[category].balance : f.totalBalance);
  if (state === 'debt') flats = flats.filter((f) => valueOf(f) > 0);
  if (state === 'paid') flats = flats.filter((f) => valueOf(f) === 0);
  if (state === 'over') flats = flats.filter((f) => valueOf(f) < 0);

  if (search) {
    const needle = search.toLowerCase();
    flats = flats.filter(
      (f) =>
        String(f.flatNumber).includes(needle) || (f.ownerName ?? '').toLowerCase().includes(needle),
    );
  }

  const allFlats = [...byFlat.values()];
  const totalPaid = allFlats.reduce((s, f) => s + f.totalPaid, 0);
  const totalDebt = allFlats.reduce((s, f) => s + Math.max(f.totalBalance, 0), 0);
  const debtors = allFlats.filter((f) => f.totalBalance > 0).length;

  /** Шүүлт солиход бусад параметрийг хэвээр авч явах URL */
  const hrefWith = (patch: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(month ? { month } : {}),
      ...(category ? { category } : {}),
      ...(state !== 'all' ? { state } : {}),
      ...(search ? { q: search } : {}),
    });
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `/admin/flats?${next}`;
  };

  // Илүү төлсөн айл — админ нүдээр шалгах ёстой тохиолдол. Хуулга буруу
  // ангилалд оногдсон эсвэл айл давхар төлсөн байж магадгүй.
  const overpaid = allFlats.filter((f) => f.totalBalance < 0).length;

  // Excel матриц — Client Component-д функц дамжуулж болохгүй тул
  // толгой ба мөрүүдийг ЭНГИЙН массив болгож бэлдэнэ
  const exportHeaders = category
    ? ['Тоот', 'Эзэн', 'Нэхэмжилсэн', 'Төлсөн', 'Үлдэгдэл']
    : ['Тоот', 'Эзэн', ...CATEGORIES.map((c) => c.label), 'Нийт төлсөн', 'Нийт үлдэгдэл'];

  const exportRows: (string | number | null)[][] = flats.map((f) =>
    category
      ? [
          f.flatNumber,
          f.ownerName,
          f.byCategory[category].billed,
          f.byCategory[category].paid,
          f.byCategory[category].balance,
        ]
      : [
          f.flatNumber,
          f.ownerName,
          ...CATEGORIES.map((c) => f.byCategory[c.key].balance),
          f.totalPaid,
          f.totalBalance,
        ],
  );

  const scope = month ? shortMonth(month) : null;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Айлууд</h1>
      <p className="mb-6 text-sm text-slate-500">
        {month
          ? `${formatBillingMonth(month)}-ын нэхэмжлэл. Төлсөн мөнгө хамгийн хуучин өрийг эхэлж хаана.`
          : 'Нэхэмжилсэн, төлсөн, үлдэгдэл. Тоо нь оршин суугчийн харж буй дүнтэй үргэлж тэнцүү.'}
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
            {scope ? `${scope} · төлсөн` : 'Нийт төлсөн'}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">
            {formatMnt(totalPaid)}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-red-800">
            {scope ? `${scope} · өр` : 'Нийт өр'}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-900">{formatMnt(totalDebt)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {scope ? `${scope} · өгөөгүй` : 'Өртэй айл'}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {debtors}
            <span className="ml-1 text-sm font-normal text-slate-400">/ {allFlats.length}</span>
          </p>
        </div>
      </div>

      {/*
        Ангилал, төлөв, сар нь ДАРАХАД ШУУД шүүнэ (холбоос) — товч дарчихаад
        дараа нь «Шүүх» дарах шаардлагатай бол юу ч болоогүй шиг санагдана.
        Хайлт л Enter шаардана: бичиж дуусахыг хүлээх ёстой.
      */}
      <FilterPanel
        action={
          <ExcelExportButton
            filename={`Айлууд ${month ?? 'хуримтлал'}${category ? ` ${CATEGORY_LABEL[category]}` : ''}`}
            sheetName="Айлууд"
            headers={exportHeaders}
            rows={exportRows}
          />
        }
      >
        <FilterField label="Сар">
          <MonthStepper months={months} current={month} allowAll allLabel="Бүх сар (хуримтлал)" />
        </FilterField>

        <FilterField label="Ангилал">
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
              { key: 'all', label: 'Бүгд', href: hrefWith({ state: '' }), active: state === 'all' },
              {
                key: 'debt',
                label: month ? 'Өгөөгүй' : 'Өртэй',
                href: hrefWith({ state: 'debt' }),
                active: state === 'debt',
              },
              {
                key: 'paid',
                label: 'Төлсөн',
                href: hrefWith({ state: 'paid' }),
                active: state === 'paid',
              },
              // Сарын хэлбэрт илүү төлөлт харагдахгүй: FIFO-д нэг сарын
              // үлдэгдэл хэзээ ч сөрөг болдоггүй, илүү мөнгө дараагийн
              // саруудыг хаадаг
              ...(month
                ? []
                : [
                    {
                      key: 'over',
                      label: 'Илүү төлсөн',
                      href: hrefWith({ state: 'over' }),
                      active: state === 'over',
                    },
                  ]),
            ]}
          />
        </FilterField>

        <FilterField label="Хайх">
          <SearchBox initial={search} />
        </FilterField>
      </FilterPanel>

      <ResultSummary
        scope={`${month ? formatBillingMonth(month) : 'Бүх сар'} · ${
          category ? CATEGORY_LABEL[category].toLowerCase() : 'бүх ангилал'
        }${
          state === 'all' ? '' : state === 'debt' ? (month ? ' · өгөөгүй' : ' · өртэй') : state === 'paid' ? ' · төлсөн' : ' · илүү төлсөн'
        }${search ? ` · «${search}»` : ''}`}
        count={flats.length}
        unit="айл"
      >
        {!month && <WarningChip count={overpaid} label="айл илүү төлсөн" />}
      </ResultSummary>

      <FlatBalanceList flats={flats} category={category} />
    </div>
  );
}
