import { FlatBalanceList, type FlatBalance } from '@/components/admin/FlatBalanceList';
import { debtForMonth, splitDebtByMonth, type InvoiceLine } from '@/lib/billing/fifo-debt';
import { formatBillingMonth, formatMnt, shortMonth } from '@/lib/format';
import { ExcelExportButton } from '@/components/admin/filters/ExcelExportButton';
import { FilterField, FilterPanel } from '@/components/admin/filters/FilterPanel';
import { MonthStepper } from '@/components/admin/filters/MonthStepper';
import { Pagination } from '@/components/admin/filters/Pagination';
import { ResultSummary } from '@/components/admin/filters/ResultSummary';
import { SearchBox } from '@/components/admin/filters/SearchBox';
import { SegmentedNav } from '@/components/admin/filters/SegmentedNav';
import { WarningChip } from '@/components/admin/filters/WarningChip';
import { hasDebt, hasOverpaid, isSettled } from '@/lib/money';
import { DEFAULT_PAGE_SIZE, paginate, parsePaging } from '@/lib/pagination';
import { matchesSearch } from '@/lib/search-flat';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { CATEGORIES, CATEGORY_LABEL, type BillCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const EMPTY = { billed: 0, paid: 0, balance: 0 };

/**
 * Шүүлтүүрийн төлөв.
 *
 * `paid` ба `zero` хоёрыг ЗААВАЛ салгана: хоёулангийн үлдэгдэл 0 боловч
 * утга нь тэс өөр.
 *
 *  · `paid` — нэхэмжилсэн бөгөөд бүрэн хаасан
 *  · `zero` — нэхэмжлэлийн дүн 0₮. Хоёр шалтгаан байж болно:
 *      тоолуурын заалт өсөөгүй (хоосон байр), эсвэл Excel-д тэр мөр
 *      огт байгаагүй. Хоёрдугаарыг чипээр тусад нь хэлнэ — тэр нь
 *      засах шаардлагатай датаны дутуу.
 */
type StateFilter = 'all' | 'debt' | 'paid' | 'over' | 'zero';

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
  searchParams: Promise<{
    category?: string;
    state?: string;
    q?: string;
    month?: string;
    flag?: string;
    page?: string;
    size?: string;
  }>;
}) {
  const params = await searchParams;
  const paging = parsePaging(params);
  const category = CATEGORY_KEYS.includes(params.category as BillCategory)
    ? (params.category as BillCategory)
    : null;
  const state: StateFilter = (['debt', 'paid', 'over', 'zero'] as const).includes(
    params.state as never,
  )
    ? (params.state as StateFilter)
    : 'all';
  const search = params.q?.trim() ?? '';
  /**
   * Чипээр шүүх — «нэхэмжлэл ороогүй» айлууд.
   *
   * Сегмент товч болгоогүй шалтгаан: энэ нь байнгын шүүлт биш, ХОВОР
   * тохиолдох датаны дутууг шалгах гарц. Товчны эгнээг уртасгах нь
   * өдөр тутмын ажилд саад болно.
   */
  const flag = params.flag === 'noinvoice' ? 'noinvoice' : null;

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

  /**
   * Нэхэмжлэлийн мөрүүд — ХОЁР хэлбэрт ч хэрэгтэй.
   *
   * Сарын хэлбэрт FIFO бодоход БҮХ сарын мөр шаардана (өмнөх сарууд
   * төлбөрийн хэдийг зарцуулсныг мэдэхгүй бол тооцоо буруу).
   *
   * Хуримтлалын хэлбэрт «мөр ОГТ байхгүй» эсэхийг мэдэхэд хэрэгтэй:
   * v_flat_balances нь НИЙЛБЭР л өгдөг тул 0₮ гэдэг нь «дүн 0» юу,
   * «мөр байхгүй» юу гэдгийг ялгаж чадахгүй. Хоёрын нэг нь хоосон байр,
   * нөгөө нь засах шаардлагатай датаны дутуу.
   */
  const invoiceRows = await fetchAllRows<{
    flat_id: string;
    category: string;
    billing_month: string;
    bill_amount: number;
  }>((from, to) =>
    db.from('invoices').select('flat_id, category, billing_month, bill_amount').range(from, to),
  );

  const numberById = new Map<string, number>(flatRows.map((f) => [f.id, f.flat_number]));

  const linesByFlat = new Map<number, InvoiceLine[]>();
  /** «тоот-ангилал» — нэхэмжлэлийн мөр БАЙГАА хосууд */
  const hasInvoice = new Set<string>();
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
    hasInvoice.add(`${flatNumber}-${row.category}`);
  }

  if (month) {
    // ── Сарын хэлбэр: FIFO-гоор тэр сарын үлдэгдлийг гаргана ──────────────
    const paidByFlat = new Map<number, Map<BillCategory, number>>();
    for (const row of balanceRows) {
      const flatNumber = row.flat_number;
      const map = paidByFlat.get(flatNumber) ?? new Map<BillCategory, number>();
      map.set(row.category as BillCategory, Number(row.total_paid));
      paidByFlat.set(flatNumber, map);
    }

    // БҮХ идэвхтэй тоотыг хамруулна — тэр сард нэхэмжлэл гараагүй айлыг
    // хаяж болохгүй. Яг тэр айлууд нь «Нэхэмжлээгүй» шүүлтээр олдох ёстой
    // датаны дутуу. Хуримтлалын хэлбэр ч 210 тоот бүгдийг харуулдаг тул
    // хоёр хэлбэрийн мөрийн тоо ижил байна.
    for (const flatNumber of nameByFlat.keys()) {
      const picked = debtForMonth(
        splitDebtByMonth(linesByFlat.get(flatNumber) ?? [], paidByFlat.get(flatNumber) ?? new Map()),
        month,
      );
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
  const balanceOf = (f: FlatBalance) =>
    category ? f.byCategory[category].balance : f.totalBalance;
  const billedOf = (f: FlatBalance) => (category ? f.byCategory[category].billed : f.totalBilled);

  // 50₮-өөс бага зөрүүг тэг гэж үзнэ — money.ts
  if (state === 'debt') flats = flats.filter((f) => hasDebt(balanceOf(f)));
  // ⚠️ «Төлсөн» нь үлдэгдэл 0 гэсэн нөхцөл ДЭЭР нэхэмжилсэн байхыг шаардана.
  // Үүнгүйгээр нэхэмжлэл огт гараагүй айл «төлсөн» гэж гарч, бүх багана 0
  // харагдана — хэрэглэгч андуурах гол шалтгаан байсан.
  if (state === 'paid') flats = flats.filter((f) => billedOf(f) > 0 && isSettled(balanceOf(f)));
  if (state === 'over') flats = flats.filter((f) => hasOverpaid(balanceOf(f)));
  if (state === 'zero') flats = flats.filter((f) => billedOf(f) === 0);

  if (flag === 'noinvoice') {
    flats = flats.filter((f) =>
      category
        ? !hasInvoice.has(`${f.flatNumber}-${category}`)
        : CATEGORIES.some((c) => !hasInvoice.has(`${f.flatNumber}-${c.key}`)),
    );
  }

  if (search) {
    flats = flats.filter((f) =>
      matchesSearch(search, { flatNumber: f.flatNumber, texts: [f.ownerName] }),
    );
  }

  const allFlats = [...byFlat.values()];
  const totalPaid = allFlats.reduce((s, f) => s + f.totalPaid, 0);
  const totalDebt = allFlats.reduce((s, f) => s + (hasDebt(f.totalBalance) ? f.totalBalance : 0), 0);
  const debtors = allFlats.filter((f) => hasDebt(f.totalBalance)).length;

  /** Шүүлт солиход бусад параметрийг хэвээр авч явах URL */
  const hrefWith = (patch: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(month ? { month } : {}),
      ...(category ? { category } : {}),
      ...(state !== 'all' ? { state } : {}),
      ...(search ? { q: search } : {}),
      ...(flag ? { flag } : {}),
      // Сонгосон мөрийн тоо шүүлт солиход алдагдахгүй. Хуудас 1 рүү буцна.
      ...(paging.size !== DEFAULT_PAGE_SIZE ? { size: String(paging.size) } : {}),
    });
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `/admin/flats?${next}`;
  };

  // Илүү төлсөн айл — админ нүдээр шалгах ёстой тохиолдол. Хуулга буруу
  // ангилалд оногдсон эсвэл айл давхар төлсөн байж магадгүй.
  const overpaid = allFlats.filter((f) => hasOverpaid(f.totalBalance)).length;

  /**
   * Нэхэмжлэлийн мөр ОГТ байхгүй айл — жинхэнэ датаны дутуу.
   *
   * «Дүн 0₮» (заалт өсөөгүй хоосон байр) нь ХЭВИЙН, түүнийг чипээр
   * анхааруулах шаардлагагүй. Харин Excel-д мөр огт байгаагүй бол тэр
   * айл нэхэмжлэлгүй үлдэж, өр хуримтлахаа болино — админ мэдэх ёстой.
   */
  const missingInvoice = allFlats.filter((f) =>
    category
      ? !hasInvoice.has(`${f.flatNumber}-${category}`)
      : CATEGORIES.some((c) => !hasInvoice.has(`${f.flatNumber}-${c.key}`)),
  ).length;

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

  // Дэлгэцэнд зөвхөн нэг хуудас. Нийлбэр, Excel нь БҮХ шүүсэн айлаар.
  const page = paginate(flats, paging);

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
              {
                key: 'zero',
                label: 'Нэхэмжлэл 0₮',
                href: hrefWith({ state: 'zero' }),
                active: state === 'zero',
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
          <SearchBox placeholder="Тоот (яг) эсвэл эзний нэр" initial={search} />
        </FilterField>
      </FilterPanel>

      {/* Хуудас солиход энд гүйлгэнэ */}
      <div id="list-top" className="scroll-mt-20" />
      <ResultSummary
        scope={`${month ? formatBillingMonth(month) : 'Бүх сар'} · ${
          category ? CATEGORY_LABEL[category].toLowerCase() : 'бүх ангилал'
        }${
          state === 'all'
            ? ''
            : state === 'debt'
              ? month
                ? ' · өгөөгүй'
                : ' · өртэй'
              : state === 'paid'
                ? ' · төлсөн'
                : state === 'zero'
                  ? ' · нэхэмжлэл 0₮'
                  : ' · илүү төлсөн'
        }${flag === 'noinvoice' ? ' · нэхэмжлэл ороогүй' : ''}${search ? ` · «${search}»` : ''}`}
        count={flats.length}
        unit="айл"
      >
        <WarningChip
          count={missingInvoice}
          label="айлд нэхэмжлэл ороогүй"
          href={hrefWith({ flag: flag === 'noinvoice' ? '' : 'noinvoice' })}
          active={flag === 'noinvoice'}
        />
        {!month && (
          <WarningChip
            count={overpaid}
            label="айл илүү төлсөн"
            href={hrefWith({ state: state === 'over' ? '' : 'over' })}
            active={state === 'over'}
          />
        )}
      </ResultSummary>

      <FlatBalanceList
        // key — хуудас солиход хүснэгтийн дотоод гүйлгээ эхэндээ буцна
        key={`${page.page}-${page.size}`}
        flats={page.rows}
        category={category}
        summary={{
          count: flats.length,
          billed: flats.reduce((s, f) => s + (category ? f.byCategory[category].billed : f.totalBilled), 0),
          paid: flats.reduce((s, f) => s + (category ? f.byCategory[category].paid : f.totalPaid), 0),
          balance: flats.reduce((s, f) => s + balanceOf(f), 0),
        }}
        pagination={
          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            size={page.size}
            total={page.total}
            from={page.from}
            to={page.to}
          />
        }
      />
    </div>
  );
}
