import { FlatBalanceList, type FlatBalance } from '@/components/admin/FlatBalanceList';
import { formatMnt } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATEGORIES, CATEGORY_LABEL, type BillCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const EMPTY = { billed: 0, paid: 0, balance: 0 };

/** Шүүлтүүрийн төлөв */
type StateFilter = 'all' | 'debt' | 'paid' | 'over';

/**
 * Айлуудын төлбөрийн жагсаалт.
 *
 * Хэн хэдийг нэхэмжилсэн, хэд төлсөн, хэд үлдсэнийг нэг дэлгэцээс харна.
 * Тоо нь v_flat_balances view-ээс шууд ирдэг тул оршин суугчийн харж буй
 * дүнтэй зөрөх боломжгүй.
 */
export default async function AdminFlatsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; state?: string; q?: string }>;
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
  const [{ data: flatRows }, { data: balanceRows }] = await Promise.all([
    db.from('flats').select('flat_number, owner_name').eq('is_active', true).limit(1000),
    db.from('v_flat_balances').select('flat_number, category, total_billed, total_paid, balance').limit(5000),
  ]);

  // v_flat_balances нь view тул flats-тай PostgREST-ээр холбож болохгүй —
  // хоёуланг нь татаад энд нэгтгэнэ. 210 айл × 3 ангилал = 630 мөр, хөнгөн.
  const nameByFlat = new Map<number, string | null>(
    (flatRows ?? []).map((f) => [f.flat_number as number, f.owner_name as string | null]),
  );

  const byFlat = new Map<number, FlatBalance>();
  for (const row of balanceRows ?? []) {
    const flatNumber = row.flat_number as number;
    if (!nameByFlat.has(flatNumber)) continue; // идэвхгүй болсон тоот

    let entry = byFlat.get(flatNumber);
    if (!entry) {
      entry = {
        flatNumber,
        ownerName: nameByFlat.get(flatNumber) ?? null,
        byCategory: { WATER_HEAT: { ...EMPTY }, SOH: { ...EMPTY }, ELECTRICITY: { ...EMPTY } },
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

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Айлууд</h1>
      <p className="mb-6 text-sm text-slate-500">
        Нэхэмжилсэн, төлсөн, үлдэгдэл. Тоо нь оршин суугчийн харж буй дүнтэй үргэлж тэнцүү.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Нийт төлсөн</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">{formatMnt(totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-red-800">Нийт өр</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-900">{formatMnt(totalDebt)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Өртэй айл</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {debtors}
            <span className="ml-1 text-sm font-normal text-slate-400">/ {allFlats.length}</span>
          </p>
        </div>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f-cat" className="mb-1 block text-xs font-medium text-slate-500">
            Ангилал
          </label>
          <select
            id="f-cat"
            name="category"
            defaultValue={category ?? ''}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">Бүгд</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-state" className="mb-1 block text-xs font-medium text-slate-500">
            Төлөв
          </label>
          <select
            id="f-state"
            name="state"
            defaultValue={state}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="all">Бүгд</option>
            <option value="debt">Өртэй</option>
            <option value="paid">Цэвэр (0)</option>
            <option value="over">Илүү төлсөн</option>
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
        {category ? CATEGORY_LABEL[category] : 'Бүх ангилал'}
        {state !== 'all' &&
          ` · ${state === 'debt' ? 'өртэй' : state === 'paid' ? 'цэвэр' : 'илүү төлсөн'}`}
        {search && ` · «${search}» хайлт`}
      </p>

      <FlatBalanceList flats={flats} category={category} />
    </div>
  );
}
