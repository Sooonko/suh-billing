import Link from 'next/link';
import { InvoiceImport } from '@/components/admin/InvoiceImport';
import { SohGenerator } from '@/components/admin/SohGenerator';
import { InvoiceList, type InvoiceRow } from '@/components/admin/InvoiceList';
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
          {/* Шүүлтүүр — URL-д хадгалагдана, хуудас сэргээхэд алдагдахгүй */}
          <form className="mb-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="list" />
            <div>
              <label htmlFor="f-cat" className="mb-1 block text-xs font-medium text-slate-500">
                Ангилал
              </label>
              <select
                id="f-cat"
                name="category"
                defaultValue={category}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="f-month" className="mb-1 block text-xs font-medium text-slate-500">
                Сар
              </label>
              <select
                id="f-month"
                name="month"
                defaultValue={month}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatBillingMonth(m)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="f-q" className="mb-1 block text-xs font-medium text-slate-500">
                Тоот эсвэл эзэн
              </label>
              <input
                id="f-q"
                name="q"
                defaultValue={search}
                placeholder="193"
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Шүүх
            </button>
          </form>

          <p className="mb-3 text-sm text-slate-500">
            {CATEGORY_LABEL[category]} · {formatBillingMonth(month)}
            {search && ` · «${search}» хайлт`}
          </p>

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
