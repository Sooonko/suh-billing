import Link from 'next/link';
import { InvoiceImport } from '@/components/admin/InvoiceImport';
import { SohGenerator } from '@/components/admin/SohGenerator';
import { InvoiceList, type InvoiceRow } from '@/components/admin/InvoiceList';
import { ExcelExportButton } from '@/components/admin/filters/ExcelExportButton';
import { FilterField, FilterPanel } from '@/components/admin/filters/FilterPanel';
import { MonthStepper } from '@/components/admin/filters/MonthStepper';
import { ResultSummary } from '@/components/admin/filters/ResultSummary';
import { SearchBox } from '@/components/admin/filters/SearchBox';
import { SegmentedNav } from '@/components/admin/filters/SegmentedNav';
import { WarningChip } from '@/components/admin/filters/WarningChip';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatBillingMonth } from '@/lib/format';
import { CATEGORIES, CATEGORY_LABEL, type BillCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

/**
 * Модуль 1 — Нэхэмжлэл.
 *
 * Хоёр хэсэг:
 *  1. Жагсаалт — оруулсан нэхэмжлэлээ хараад ЗААЛТЫГ засах
 *  2. Импорт — Excel-ээс шинэ сар оруулах (доор нугалсан)
 *
 * ⚠️ bill_amount нь ЗӨВХӨН тухайн сарын тооцоо. Өмнөх үлдэгдлийг ЭНД
 * нэмэхгүй — систем үлдэгдлийг өөрөө хуримтлуулж бодно.
 */
export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; month?: string; q?: string; tab?: string }>;
}) {
  const params = await searchParams;
  // Таб нь URL-д — шүүлт, хуудас сэргээхэд алдагдахгүй
  const tab = params.tab === 'import' ? 'import' : 'list';
  const db = createAdminClient();

  // Ямар сарууд бүртгэгдсэн бэ — шүүлтүүрийн сонголт
  const { data: monthRows } = await db
    .from('invoices')
    .select('billing_month')
    .order('billing_month', { ascending: false });
  const months = [...new Set((monthRows ?? []).map((r) => r.billing_month as string))];

  const category = (
    CATEGORY_KEYS.includes(params.category as BillCategory) ? params.category : 'WATER_HEAT'
  ) as BillCategory;
  const month = params.month && months.includes(params.month) ? params.month : (months[0] ?? '');
  const search = params.q?.trim() ?? '';

  let invoices: InvoiceRow[] = [];
  if (month) {
    const { data } = await db
      .from('invoices')
      .select(
        'id, category, billing_month, prev_reading, current_reading, hot_prev, hot_current, cold_prev, cold_current, usage_amount, bill_amount, note, flats!inner(flat_number, owner_name)',
      )
      .eq('category', category)
      .eq('billing_month', month)
      .limit(1000);
    // Эрэмбийг ЭНД хийнэ: PostgREST-ийн .order(referencedTable) нь холбоос
    // дотоод мөрийг эрэмбэлдэг, эцэг мөрийг биш. Тоот нь холбоос дотор тул
    // JS талдаа эрэмбэлэх нь эргэлзээгүй зөв.

    invoices = (data ?? []).map((row) => {
      // PostgREST-ийн холбоос нэг объект болж ирнэ (!inner тул массив биш)
      const flat = row.flats as unknown as { flat_number: number; owner_name: string | null };
      return {
        id: row.id as string,
        flat_number: flat.flat_number,
        owner_name: flat.owner_name,
        category: row.category as BillCategory,
        billing_month: row.billing_month as string,
        prev_reading: row.prev_reading === null ? null : Number(row.prev_reading),
        current_reading: row.current_reading === null ? null : Number(row.current_reading),
        // numeric баганууд PostgREST-ээс текстээр ирдэг тул тоо болгоно
        hot_prev: row.hot_prev === null ? null : Number(row.hot_prev),
        hot_current: row.hot_current === null ? null : Number(row.hot_current),
        cold_prev: row.cold_prev === null ? null : Number(row.cold_prev),
        cold_current: row.cold_current === null ? null : Number(row.cold_current),
        usage_amount: row.usage_amount === null ? null : Number(row.usage_amount),
        bill_amount: Number(row.bill_amount),
        note: row.note as string | null,
      };
    });

    invoices.sort((a, b) => a.flat_number - b.flat_number);

    if (search) {
      const needle = search.toLowerCase();
      invoices = invoices.filter(
        (i) =>
          String(i.flat_number).includes(needle) ||
          (i.owner_name ?? '').toLowerCase().includes(needle),
      );
    }
  }

  /**
   * Эмзэг мөрүүдийг тоолно.
   *
   * «Заалт нэмэгдээгүй» (зөрүү 0) нь тоолуур эвдэрсэн, эсвэл айл хоосон
   * байсныг хэлж болно — хоёр тохиолдолд ч админ нүдээр шалгах ёстой.
   * «Заалт ороогүй» нь Excel-д нүд хоосон үлдсэн гэсэн үг.
   */
  const meterPairs = (i: InvoiceRow): [number | null, number | null][] =>
    i.category === 'WATER_HEAT'
      ? [
          [i.hot_prev, i.hot_current],
          [i.cold_prev, i.cold_current],
        ]
      : i.category === 'ELECTRICITY'
        ? [[i.prev_reading, i.current_reading]]
        : [];

  const noGrowth = invoices.filter((i) =>
    meterPairs(i).some(([prev, cur]) => prev !== null && cur !== null && cur - prev === 0),
  ).length;

  const missing = invoices.filter((i) =>
    meterPairs(i).some(([prev, cur]) => prev === null || cur === null),
  ).length;

  // Excel матриц — Client Component-д функц дамжуулж болохгүй тул
  // толгой ба мөрүүдийг ЭНГИЙН массив болгож бэлдэнэ
  const exportHeaders =
    category === 'WATER_HEAT'
      ? ['Тоот', 'Эзэн', 'Халуун өмнөх', 'Халуун одоо', 'Халуун зөрүү', 'Хүйтэн өмнөх', 'Хүйтэн одоо', 'Хүйтэн зөрүү', 'Нийт м³', 'Төлбөр']
      : category === 'ELECTRICITY'
        ? ['Тоот', 'Эзэн', 'Өмнөх заалт', 'Одоогийн заалт', 'Зөрүү', 'кВт·ц', 'Төлбөр']
        : ['Тоот', 'Эзэн', 'Төлбөр'];

  const gap = (prev: number | null, cur: number | null) =>
    prev === null || cur === null ? null : Math.round((cur - prev) * 100) / 100;

  const exportRows: (string | number | null)[][] = invoices.map((i) =>
    category === 'WATER_HEAT'
      ? [i.flat_number, i.owner_name, i.hot_prev, i.hot_current, gap(i.hot_prev, i.hot_current), i.cold_prev, i.cold_current, gap(i.cold_prev, i.cold_current), i.usage_amount, i.bill_amount]
      : category === 'ELECTRICITY'
        ? [i.flat_number, i.owner_name, i.prev_reading, i.current_reading, gap(i.prev_reading, i.current_reading), i.usage_amount, i.bill_amount]
        : [i.flat_number, i.owner_name, i.bill_amount],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">
          Нэхэмжлэл
        </h1>

        {/* Харах ба оруулах хоёр огт өөр ажил — нэг хуудсанд хольсноор
            жагсаалт урт болж, оруулах товчнууд доор булагддаг байв. */}
        <nav className="flex gap-1 border-b border-slate-200">
          {[
            { key: 'list', label: 'Жагсаалт' },
            { key: 'import', label: 'Нэхэмжлэл оруулах' },
          ].map((item) => (
            <Link
              key={item.key}
              href={`/admin/invoices?tab=${item.key}`}
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
      </div>

      {tab === 'list' && (months.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          Нэхэмжлэл хараахан оруулаагүй байна. «Оруулах» табаас эхэлнэ.
        </div>
      ) : (
        <section>
          {/*
            Шүүлтүүр — URL-д хадгалагдана, хуудас сэргээхэд алдагдахгүй.
            Ангилал ба сар нь ДАРАХАД ШУУД шүүнэ (холбоос), хайлт л Enter
            шаардана — бичиж дуусахыг хүлээх ёстой.
          */}
          <FilterPanel
            action={
              <ExcelExportButton
                filename={`${CATEGORY_LABEL[category]} ${month}`}
                sheetName={CATEGORY_LABEL[category]}
                headers={exportHeaders}
                rows={exportRows}
              />
            }
          >
            <FilterField label="Ангилал">
              <SegmentedNav
                items={CATEGORIES.map((c) => ({
                  key: c.key,
                  label: c.label,
                  // Сар ба хайлтыг ХЭВЭЭР авч явна — ангилал сольсон
                  // болгонд 9 сар руу гараар буцах нь хэрэггүй ажил
                  href: `/admin/invoices?${new URLSearchParams({
                    tab: 'list',
                    category: c.key,
                    ...(month ? { month } : {}),
                    ...(search ? { q: search } : {}),
                  })}`,
                  active: c.key === category,
                }))}
              />
            </FilterField>

            <FilterField label="Сар">
              <MonthStepper months={months} current={month} />
            </FilterField>

            <FilterField label="Хайх">
              <SearchBox initial={search} />
            </FilterField>
          </FilterPanel>

          <ResultSummary
            scope={`${formatBillingMonth(month)}-ын ${CATEGORY_LABEL[category].toLowerCase()}`}
            count={invoices.length}
          >
            <WarningChip count={noGrowth} label="мөрд заалт нэмэгдээгүй" />
            <WarningChip count={missing} label="мөрд заалт ороогүй" />
          </ResultSummary>

          <InvoiceList invoices={invoices} category={category} month={month} />
        </section>
      ))}

      {tab === 'import' && (
        <div className="space-y-6">
          {/* СӨХ нь тоолуургүй, бүх айлд ижил тул Excel импорт хэрэггүй.
              Гарчгийг картын ГАДНА тавьсан — доторх бүрэлдэхүүн өөрийн
              карттай тул давхар хүрээ үүсэхгүй. */}
          <section>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              СӨХ-ийн сарын хураамж
            </h2>
            <p className="mb-3 mt-0.5 text-sm text-slate-500">
              Тоолуургүй, бүх айлд ижил. Идэвхтэй БҮХ тоотод нэг дор үүсгэнэ. Дүнг{' '}
              <Link href="/admin/tariffs" className="underline decoration-slate-300">
                Тариф
              </Link>{' '}
              цэснээс авна.
            </p>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <SohGenerator />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Ус, дулаан · Цахилгаан
            </h2>
            <p className="mb-3 mt-0.5 text-sm text-slate-500">
              Excel дээр ЗӨВХӨН заалтыг бичнэ — төлбөрийг систем тарифаар бодно.
            </p>
            <InvoiceImport />
          </section>
        </div>
      )}
    </div>
  );
}
