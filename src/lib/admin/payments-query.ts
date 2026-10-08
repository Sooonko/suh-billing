import type { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { matchesSearch } from '@/lib/search-flat';
import { CATEGORIES, type BillCategory } from '@/lib/types';

/**
 * «Баримт» жагсаалтын шүүлт ба дата татах — хуудас (page.tsx) болон Excel
 * татах API ХОЁУЛАА энийг хэрэглэнэ. Ингэснээр дэлгэцэнд харагдаж буй
 * мөрүүд ба Excel-д орох мөрүүд ХЭЗЭЭ Ч зөрөхгүй.
 *
 * ХУРДНЫ ЗАРЧИМ:
 *  1. «Индекс» — шүүсэн БҮХ гүйлгээний НАРИЙН багана (id, дүн, үлдэгдэл,
 *     төлөв, утга). Нийт дүн, тоолол, хуудасны тоог үүнээс бодно.
 *  2. Дэлгэцэнд харагдах 10–200 мөрийг л бүтэн (хуваарилалт, тоот) татна.
 *
 * Өмнө нь 1000 мөрийг бүтнээр нь татаж, бүгдийг нь зурдаг байсан бөгөөд
 * `.limit(1000)` нь 1000-аас хойшх гүйлгээг ЧИМЭЭГҮЙ хасдаг байв — нийт
 * дүн ч буруу гардаг. Индекс нь `fetchAllRows`-оор БҮГДИЙГ авна.
 */

type Db = ReturnType<typeof createAdminClient>;

export const TXN_STATUSES = ['MATCHED', 'PARTIAL', 'UNMATCHED', 'IGNORED'] as const;
export type TxnStatus = (typeof TXN_STATUSES)[number];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface PaymentFilters {
  category: BillCategory | null;
  status: TxnStatus | null;
  /** 'YYYY-MM' — тухайн сард ХИЙГДСЭН гүйлгээ. Хоосон бол бүх хугацаа. */
  month: string;
  search: string;
}

/** URL-ын параметрийг шалгаж уншина — буруу утгыг үл тооно */
export function parsePaymentFilters(params: {
  category?: string | null;
  status?: string | null;
  month?: string | null;
  q?: string | null;
}): PaymentFilters {
  return {
    category: CATEGORY_KEYS.includes(params.category as BillCategory)
      ? (params.category as BillCategory)
      : null,
    status: TXN_STATUSES.includes(params.status as TxnStatus) ? (params.status as TxnStatus) : null,
    month: MONTH_RE.test(params.month ?? '') ? params.month! : '',
    search: params.q?.trim() ?? '',
  };
}

/** Сарын эхнээс дараа сарын эхэн хүртэл */
function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return [`${month}-01`, next];
}

/**
 * DB талын шүүлт (данс, төлөв, сар). Хайлтыг энд хийхгүй — доор JS талд.
 *
 * ЯАГААД ХАЙЛТ JS-Д: тоогоор хайхад «оногдсон тоот ЭСВЭЛ (оногдоогүй бол)
 * таасан тоот» гэсэн дүрэм PostgREST-ийн шүүлтээр илэрхийлэгдэхгүй. Мөн
 * Postgres-ийн `ilike` нь кирилл ө, ү-г серверийн locale-оос хамаарч
 * жижиг/том ялгаж магадгүй. JS-ийн `toLowerCase` нь найдвартай.
 */
function applyDbFilters(query: unknown, filters: PaymentFilters): FilterableQuery {
  let q = query as FilterableQuery;
  if (filters.category) q = q.eq('source_category', filters.category);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.month) {
    const [start, end] = monthRange(filters.month);
    q = q.gte('txn_date', start).lt('txn_date', end);
  }
  // Эрэмбэд `id`-г нэмсэн шалтгаан: нэг өдөр олон гүйлгээ байдаг. Зөвхөн
  // огноогоор эрэмбэлбэл тэнцүү мөрүүдийн дараалал хүсэлт бүрт өөр байж,
  // нэг гүйлгээ 1, 2-р хуудсанд ДАВХАР гарч, өөр нэг нь ОГТ гарахгүй байж болно.
  return q.order('txn_date', { ascending: false }).order('id', { ascending: true });
}

/**
 * PostgREST builder-ийн бидэнд хэрэгтэй хэсэг. Бүрэн генерик төрөл нь
 * TypeScript-ийг «хэт гүнзгий» алдаанд оруулдаг тул энгийн хэлбэрээр.
 */
interface FilterableQuery {
  eq(column: string, value: string): FilterableQuery;
  gte(column: string, value: string): FilterableQuery;
  lt(column: string, value: string): FilterableQuery;
  order(column: string, options: { ascending: boolean }): FilterableQuery;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
}

/**
 * Тоогоор хайхад — тухайн тоотод ОНОГДСОН гүйлгээнүүдийн id.
 * Хайлт тоо биш бол null.
 */
async function idsAllocatedToFlat(db: Db, search: string): Promise<Set<string> | null> {
  if (!/^\d+$/.test(search)) return null;

  const { data: flats, error } = await db.from('flats').select('id').eq('flat_number', Number(search));
  if (error) throw new Error(error.message);
  const flatIds = (flats ?? []).map((f) => f.id as string);
  if (flatIds.length === 0) return new Set();

  const rows = await fetchAllRows<{ transaction_id: string }>((from, to) =>
    db
      .from('allocations')
      .select('transaction_id')
      .in('flat_id', flatIds)
      .order('id')
      .range(from, to),
  );
  return new Set(rows.map((r) => r.transaction_id));
}

/**
 * Хайлтын дүрэм — `search-flat.ts`-тэй ижил утгатай:
 *  · Цэвэр тоо → тоотын ЯГ тохирол. Оногдсон бол оногдсон тоотоор,
 *    оногдоогүй бол утгаас ТААСАН тоотоор.
 *  · Бусад → гүйлгээний утгын хэсэгчилсэн хайлт.
 *
 * Олон айлд хуваасан гүйлгээ аль ч айлынхаараа олдоно (өмнө нь зөвхөн
 * эхний айлаар олддог байв).
 */
function matchesTxn(
  search: string,
  allocatedIds: Set<string> | null,
  row: { id: string; description: string; parsed_flat_number: number | null; hasAllocations: boolean },
): boolean {
  if (!search) return true;
  if (allocatedIds) {
    if (allocatedIds.has(row.id)) return true;
    return !row.hasAllocations && row.parsed_flat_number === Number(search);
  }
  return matchesSearch(search, { texts: [row.description] });
}

export interface PaymentIndexRow {
  id: string;
  amount: number;
  /** Хуваарилагдаагүй үлдэгдэл */
  remaining: number;
  status: string;
}

/** Шүүсэн БҮХ гүйлгээний нарийн жагсаалт — огноогоор буурахаар */
type IndexRaw = {
  id: string;
  amount: number | string;
  remaining: number | string;
  status: string;
  parsed_flat_number: number | null;
  description: string;
};

export async function loadPaymentIndex(db: Db, filters: PaymentFilters): Promise<PaymentIndexRow[]> {
  const [rows, allocatedIds] = await Promise.all([
    fetchAllRows<IndexRaw>(
      (from, to) =>
        applyDbFilters(
          db
            .from('v_transactions_remaining')
            .select('id, amount, remaining, status, parsed_flat_number, description'),
          filters,
        ).range(from, to) as PromiseLike<{ data: IndexRaw[] | null; error: { message: string } | null }>,
    ),
    idsAllocatedToFlat(db, filters.search),
  ]);

  const out: PaymentIndexRow[] = [];
  for (const r of rows) {
    // numeric баганууд PostgREST-ээс текстээр ирдэг
    const amount = Number(r.amount);
    const remaining = Number(r.remaining);
    const keep = matchesTxn(filters.search, allocatedIds, {
      id: r.id,
      description: r.description,
      parsed_flat_number: r.parsed_flat_number,
      // Хагас мөнгө хуваарилсан ч «оногдсон» гэж үзнэ
      hasAllocations: remaining < amount - 0.005,
    });
    if (keep) out.push({ id: r.id, amount, remaining, status: r.status });
  }
  return out;
}

export interface PaymentRow {
  id: string;
  txn_date: string;
  amount: number;
  description: string;
  source_category: BillCategory;
  status: string;
  parsed_flat_number: number | null;
  allocations: { id: string; amount: number; category: BillCategory; flat: string }[];
}

const FULL_SELECT =
  'id, txn_date, amount, description, source_category, status, parsed_flat_number, allocations(id, amount, category, flats(flat_number))';

type RawRow = {
  id: string;
  txn_date: string;
  amount: number | string;
  description: string;
  source_category: BillCategory;
  status: string;
  parsed_flat_number: number | null;
  allocations:
    | { id: string; amount: number | string; category: BillCategory; flats: { flat_number: number } | null }[]
    | null;
};

function toRow(t: RawRow): PaymentRow {
  return {
    id: t.id,
    txn_date: t.txn_date,
    amount: Number(t.amount),
    description: t.description,
    source_category: t.source_category,
    status: t.status,
    parsed_flat_number: t.parsed_flat_number,
    allocations: (t.allocations ?? []).map((a) => ({
      id: a.id,
      amount: Number(a.amount),
      category: a.category,
      flat: a.flats ? String(a.flats.flat_number) : '—',
    })),
  };
}

/**
 * Зөвхөн нэг хуудасны мөрүүдийг бүтнээр нь татна — индексийн дарааллаар.
 *
 * id-г 100-аар хуваана: URL-ын урт хязгаартай (uuid бүр ~37 тэмдэгт).
 */
export async function loadPaymentRows(db: Db, ids: string[]): Promise<PaymentRow[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

  const results = await Promise.all(
    chunks.map((chunk) => db.from('transactions').select(FULL_SELECT).in('id', chunk)),
  );

  const byId = new Map<string, PaymentRow>();
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    for (const raw of (data ?? []) as unknown as RawRow[]) byId.set(raw.id, toRow(raw));
  }
  // Индексийн дараалал хэвээр. Хооронд нь устсан мөр байвал алгасна.
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/**
 * Excel-д — шүүсэн БҮХ мөрийг бүтнээр нь. Хуудаслахгүй.
 *
 * Индекс + id-аар татахын оронд шууд хуудаслаж татна: 3000 мөрийг 100-аар
 * хуваавал 30 хүсэлт, харин 1000-аар 3 хүсэлт.
 */
export async function loadAllPaymentRows(db: Db, filters: PaymentFilters): Promise<PaymentRow[]> {
  const [raw, allocatedIds] = await Promise.all([
    fetchAllRows<RawRow>((from, to) =>
      applyDbFilters(db.from('transactions').select(FULL_SELECT), filters).range(
        from,
        to,
      ) as PromiseLike<{ data: RawRow[] | null; error: { message: string } | null }>,
    ),
    idsAllocatedToFlat(db, filters.search),
  ]);

  return raw
    .map(toRow)
    .filter((r) =>
      matchesTxn(filters.search, allocatedIds, {
        id: r.id,
        description: r.description,
        parsed_flat_number: r.parsed_flat_number,
        hasAllocations: r.allocations.length > 0,
      }),
    );
}

/** Excel-ийн толгой ба мөрүүд — дэлгэцийн баганатай ижил */
export const PAYMENT_EXPORT_HEADERS = ['Огноо', 'Дүн', 'Гүйлгээний утга', 'Оногдсон тоот', 'Данс', 'Төлөв'];

export const STATUS_LABEL: Record<string, string> = {
  MATCHED: 'Хуваарилсан',
  PARTIAL: 'Дутуу',
  UNMATCHED: 'Хуваарилаагүй',
  IGNORED: 'Тооцохгүй',
};
