import { TariffEditor } from '@/components/admin/TariffEditor';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATEGORY_LABEL, type Tariff } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Тарифын цэс — Excel дээрх ШАР нүднүүд энд шилжлээ.
 *
 * Ус дулааны төлбөрийг систем эдгээр утгаар бодно. Өөрчлөхөд шинэ мөр үүсч,
 * хуучин нь огноогоор хаагдана — өнгөрсөн сар хөндөгдөхгүй.
 */
export default async function AdminTariffsPage() {
  const db = createAdminClient();
  const { data, error } = await db
    .from('tariffs')
    .select('id, category, code, label, unit, rate, sort_order, entrance, effective_from, effective_to')
    .order('category')
    .order('sort_order')
    .order('effective_from', { ascending: false });

  const all = (data ?? []).map((t) => ({ ...t, rate: Number(t.rate) })) as Tariff[];
  const categories = [...new Set(all.map((t) => t.category))];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Тариф</h1>
      <p className="mb-6 text-sm text-slate-500">
        Excel дээрх шар нүднүүд. Систем нэхэмжлэлийг эдгээр утгаар бодно.
      </p>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Тарифын хүснэгт уншигдсангүй</p>
          <p className="mt-1">{error.message}</p>
          <p className="mt-2">
            Supabase → SQL Editor дээр <code className="font-mono">supabase/schema.sql</code>-ыг
            дахин RUN дарна уу.
          </p>
        </div>
      )}

      {categories.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          Тариф бүртгэгдээгүй байна. schema.sql-ыг RUN дарснаар эхлэлийн утгууд орно.
        </div>
      )}

      <div className="space-y-10">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">
              {CATEGORY_LABEL[category] ?? category}
            </h2>
            <TariffEditor
              current={all.filter((t) => t.category === category && t.effective_to === null)}
              history={all.filter((t) => t.category === category && t.effective_to !== null)}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
