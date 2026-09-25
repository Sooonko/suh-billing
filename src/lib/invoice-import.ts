import { createAdminClient } from '@/lib/supabase/admin';
import { calculateElectricity, ElectricityError } from '@/lib/billing/electricity';
import { calculateWaterHeat, WaterHeatError, type BillLine, type TariffRow } from '@/lib/billing/water-heat';
import { parseInvoices, type RawRow } from '@/lib/matching/parse-invoices';
import { createFlatResolver } from '@/lib/billing/flat-resolver';
import { resolveTariffs, type TariffWithEntrance } from '@/lib/billing/resolve-tariffs';
import { parseElectricityInvoices } from '@/lib/matching/parse-electricity-invoices';
import { parseWaterInvoices } from '@/lib/matching/parse-water-invoices';
import type { BillCategory } from '@/lib/types';

/**
 * Нэхэмжлэлийн импортын хуваалцсан логик.
 *
 * preview ба commit хоёр route ИЖИЛ функцээр задлан шинжилнэ. Ингэснээр
 * админ харсан тоо, датабазад орох тоо хоёр зөрөх боломжгүй.
 *
 * Хоёр урсгал:
 *  · WATER_HEAT — 4 заалт уншаад тарифаар СИСТЕМ бодно
 *  · бусад      — Excel дээрх бэлэн "Дүн" баганыг уншина
 */

const CATEGORIES: BillCategory[] = ['WATER_HEAT', 'SOH', 'ELECTRICITY'];

/** Excel-ийн нэг таб */
export interface SheetInput {
  /** Табын нэр — «9 сар 1 орц». Алдаа тайлагнахад хэрэглэнэ. */
  name: string;
  rows: RawRow[];
  /** Толгой Excel дээр хэддүгээр мөрөнд байсан бэ */
  headerRow: number;
}

export interface InvoiceImportInput {
  category?: string;
  billingMonth?: string;
  /**
   * Файлын бүх таб. СӨХ нэхэмжлэлээ орцоор хуваадаг («1 орц», «2 орц») тул
   * табуудыг НЭГТГЭЖ боловсруулна — тоот байр даяар unique учир орц
   * тулгалтад хамаагүй.
   */
  sheets?: SheetInput[];
  /**
   * Админ «оруул» гэж ЗӨВШӨӨРСӨН эмзэг мөрүүд, «<таб>::<мөр>» хэлбэрээр.
   *
   * Заалт дутуу мөрийг систем анхныхаа байдлаар алгасдаг. Гэхдээ заримдаа
   * тэр айлыг огт нэхэмжлэхгүй орхих нь илүү хортой (8 сарын 109 тоот
   * ингэж бүтэн сар нэхэмжлэлгүй үлдсэн). Шийдвэрийг СИСТЕМ биш, ХҮН
   * гаргана: харалт дээр жагсаагаад админ мөр бүрийг чагтална.
   *
   * Мөрийн дугаар нь АДМИНД ХАРАГДАХ дугаар (толгойн шилжилт нэмэгдсэн).
   */
  includeRows?: string[];
}

export type InvoiceImportError = { error: string; status: number };

export interface ImportRow {
  rowIndex: number;
  /** Аль табаас ирсэн бэ */
  sheet: string;
  /** Табын нэрнээс таасан орц — flats хүснэгтэд тэмдэглэхэд */
  entrance: number | null;
  flatNumber: number;
  flatId: string;
  prevReading: number | null;
  currentReading: number | null;
  usageAmount: number | null;
  billAmount: number;
  note: string | null;
  /** Тухайн сард аль хэдийн нэхэмжлэл байгаа эсэх — байвал ДАРЖ бичнэ */
  isReplacing: boolean;
  // ── зөвхөн ус дулаанд ──
  hotPrev?: number;
  hotCurrent?: number;
  coldPrev?: number;
  coldCurrent?: number;
  breakdown?: BillLine[];
}

export interface InvoiceImportAnalysis {
  category: BillCategory;
  billingMonth: string;
  columns: Record<string, string | undefined>;
  /** Ус дулаанд ямар тариф хэрэглэсэн бэ — админ шалгана */
  tariffs: TariffRow[];
  valid: ImportRow[];
  /** flats хүснэгтэд байхгүй тоот — бүртгэхгүй */
  unknownFlats: { sheet: string; rowIndex: number; flatNumber: number }[];
  skipped: { sheet: string; rowIndex: number; raw: string; reason: string; canInclude?: boolean }[];
  /** Хоёр табад ижил тоот — аль нь зөв бэ гэдгийг систем шийдэхгүй */
  duplicateFlats: { flatNumber: number; sheets: string[] }[];
  /** Таб тус бүрийн тоо — админ бүх орц орсон эсэхийг хардаг */
  sheetSummary: { name: string; rows: number; imported: number }[];
  totalAmount: number;
}

/** 'YYYY-MM' хэлбэр — DB-ийн check constraint-тай ижил дүрэм */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Тухайн сард ХҮЧИНТЭЙ байсан тарифыг авах.
 *
 * Сарын эхний өдрөөр шүүнэ. Тариф дунд сараас өөрчлөгдвөл тухайн сар нь
 * хуучин тарифаар бодогдоно — дараа сараас шинэ тариф үйлчилнэ.
 */
async function loadTariffs(
  db: ReturnType<typeof createAdminClient>,
  category: BillCategory,
  billingMonth: string,
): Promise<TariffWithEntrance[]> {
  const monthStart = `${billingMonth}-01`;

  const { data } = await db
    .from('tariffs')
    .select('code, label, unit, rate, entrance, sort_order')
    .eq('category', category)
    .lte('effective_from', monthStart)
    .or(`effective_to.is.null,effective_to.gte.${monthStart}`)
    .order('sort_order');

  return (data ?? []).map((t) => ({
    code: t.code as string,
    label: t.label as string,
    unit: t.unit as TariffRow['unit'],
    rate: Number(t.rate),
    entrance: t.entrance === null ? null : Number(t.entrance),
    sortOrder: Number(t.sort_order),
  }));
}

/**
 * Табын нэрнээс орцыг таах — «9 сар 1 орц» → 1.
 *
 * СӨХ нэхэмжлэлээ орцоор нь тусад нь табласан байдаг. Орц нь тарифт
 * нөлөөлдөг (жишээ: 1 орц ус халаалт аваагүй) тул импортын үед flats
 * хүснэгтэд тэмдэглэж авна.
 */
export function parseEntrance(sheetName: string): number | null {
  const match = sheetName.match(/(\d{1,2})\s*-?\s*[рp]?\s*орц/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function analyzeInvoiceImport(
  input: InvoiceImportInput,
): Promise<InvoiceImportAnalysis | InvoiceImportError> {
  const { category, billingMonth } = input;

  if (!category || !CATEGORIES.includes(category as BillCategory)) {
    return { error: 'Ангилал буруу байна', status: 400 };
  }
  if (!billingMonth || !MONTH_RE.test(billingMonth)) {
    return { error: 'Тооцооны сар "2026-09" хэлбэртэй байх ёстой', status: 400 };
  }

  // Мөртэй табуудыг л авна — хоосон таб файлд байж болно
  const sheets = (input.sheets ?? []).filter((sheet) => sheet.rows?.length);
  if (!sheets.length) {
    return { error: 'Мөр байхгүй байна', status: 400 };
  }

  const db = createAdminClient();
  const cat = category as BillCategory;

  const { data: flats } = await db
    .from('flats')
    .select('id, flat_number, owner_name, excel_label, entrance')
    .eq('is_active', true);
  const flatIdByNumber = new Map<number, string>((flats ?? []).map((f) => [f.flat_number, f.id]));
  const entranceByFlatId = new Map<string, number | null>(
    (flats ?? []).map((f) => [f.id as string, f.entrance === null ? null : Number(f.entrance)]),
  );
  const validFlats = new Set(flatIdByNumber.keys());
  // «дэлгүүр», «amo sport» гэх нэрээр бичигдсэн мөрүүдийг ч таних
  const resolveFlat = createFlatResolver(
    (flats ?? []).map((f) => ({
      flatNumber: f.flat_number,
      name: f.owner_name,
      excelLabel: f.excel_label,
    })),
  );

  // Тухайн сард аль хэдийн орсон нэхэмжлэлүүд — дарж бичихийг урьдчилж хэлнэ
  const { data: existing } = await db
    .from('invoices')
    .select('flat_id')
    .eq('category', cat)
    .eq('billing_month', billingMonth);
  const existingFlatIds = new Set((existing ?? []).map((r) => r.flat_id));

  const valid: ImportRow[] = [];
  const unknownFlats: InvoiceImportAnalysis['unknownFlats'] = [];
  const skipped: InvoiceImportAnalysis['skipped'] = [];
  const sheetSummary: InvoiceImportAnalysis['sheetSummary'] = [];
  let columns: Record<string, string | undefined> = {};
  let tariffs: TariffWithEntrance[] = [];

  // Ус дулаан ба цахилгааныг СИСТЕМ бодно — тариф заавал хэрэгтэй
  const isComputed = cat === 'WATER_HEAT' || cat === 'ELECTRICITY';
  if (isComputed) {
    tariffs = await loadTariffs(db, cat, billingMonth);
    if (!tariffs.length) {
      return {
        error: `${billingMonth} сард ${cat} ангиллын хүчинтэй тариф олдсонгүй. /admin/tariffs цэсээс тариф оруулна уу.`,
        status: 400,
      };
    }
  }

  /**
   * Админы зөвшөөрсөн мөрүүдийг таб тус бүрээр бүлэглэнэ.
   * Түлхүүр нь «<таб>::<админд харагдах мөр>» тул задлагч руу өгөхдөө
   * толгойн шилжилтийг ХАСНА.
   */
  const forcedBySheet = new Map<string, Set<number>>();
  for (const key of input.includeRows ?? []) {
    const at = key.lastIndexOf('::');
    if (at < 0) continue;
    const sheetName = key.slice(0, at);
    const displayed = Number(key.slice(at + 2));
    if (!Number.isInteger(displayed)) continue;
    const set = forcedBySheet.get(sheetName) ?? new Set<number>();
    set.add(displayed);
    forcedBySheet.set(sheetName, set);
  }

  // ── Таб тус бүрийг боловсруулаад нэгтгэнэ ─────────────────────────────────
  for (const sheet of sheets) {
    // Excel дээрх жинхэнэ мөрийн дугаар = толгойн мөрөөс хойш
    const offset = (sheet.headerRow ?? 1) - 1;
    // Задлагч нь шилжилтгүй дугаараар ажилладаг
    const forced = new Set(
      [...(forcedBySheet.get(sheet.name) ?? [])].map((displayed) => displayed - offset),
    );
    const before = valid.length;
    // «9 сар 1 орц» → 1. Тариф орцоор ялгаатай байж болно.
    const sheetEntrance = parseEntrance(sheet.name);

    if (cat === 'WATER_HEAT') {
      // ── Ус дулаан: заалт уншаад СИСТЕМ бодно ─────────────────────────────
      const parsed = parseWaterInvoices(sheet.rows, resolveFlat, forced);
      // Багануудыг эхний ТАНИГДСАН табаас авч харуулна
      if (!columns.flat) columns = parsed.columns as Record<string, string | undefined>;

      if (!parsed.columns.flat) {
        return {
          error: `«${sheet.name}» табад "Тоот" багана олдсонгүй. Файлын толгой мөрийг шалгана уу.`,
          status: 400,
        };
      }
      if (!parsed.columns.hotCurrent || !parsed.columns.coldCurrent) {
        return {
          error: `«${sheet.name}» табад заалтын багана дутуу. «Халуун ус … заалт» ба «Хүйтэн ус … заалт» тус бүр ХОЁР багана (өмнөх, одоогийн) байх ёстой.`,
          status: 400,
        };
      }

      skipped.push(
        ...parsed.skipped.map((row) => ({ ...row, rowIndex: row.rowIndex + offset, sheet: sheet.name })),
      );

      for (const row of parsed.rows) {
        const rowIndex = row.rowIndex + offset;
        const flatId = flatIdByNumber.get(row.flatNumber);
        if (!flatId) {
          unknownFlats.push({ sheet: sheet.name, rowIndex, flatNumber: row.flatNumber });
          continue;
        }

        try {
          // Орц бүр өөр тарифтай байж болно — 1 орц ус халаалт аваагүй г.м
          const bill = calculateWaterHeat(
            row,
            resolveTariffs(tariffs, sheetEntrance ?? entranceByFlatId.get(flatId) ?? null),
          );
          valid.push({
            rowIndex,
            sheet: sheet.name,
            entrance: sheetEntrance,
            flatNumber: row.flatNumber,
            flatId,
            // Нэгтгэсэн заалтыг үндсэн багануудад хадгалахгүй — халуун/хүйтэн
            // тусдаа багананд бичигдэнэ
            prevReading: null,
            currentReading: null,
            usageAmount: bill.totalUsage,
            billAmount: bill.total,
            // Админ зөвшөөрсөн эмзэг мөр бол ШАЛТГААНЫГ үлдээнэ
            note: row.forcedNote ?? null,
            isReplacing: existingFlatIds.has(flatId),
            hotPrev: row.hotPrev,
            hotCurrent: row.hotCurrent,
            coldPrev: row.coldPrev,
            coldCurrent: row.coldCurrent,
            breakdown: bill.lines,
          });
        } catch (error) {
          // Заалт буурсан — дуугүй 0 болгохгүй, админ шийднэ
          skipped.push({
            sheet: sheet.name,
            rowIndex,
            raw: String(row.flatNumber),
            reason: error instanceof WaterHeatError ? error.message : 'Бодоход алдаа гарлаа',
          });
        }
      }
    } else if (cat === 'ELECTRICITY') {
      // ── Цахилгаан: нэг тоолуурын 2 заалт уншаад СИСТЕМ бодно ────────────
      const parsed = parseElectricityInvoices(sheet.rows, resolveFlat, forced);
      if (!columns.flat) columns = parsed.columns as Record<string, string | undefined>;

      if (!parsed.columns.flat) {
        return {
          error: `«${sheet.name}» табад "Тоот" багана олдсонгүй. Файлын толгой мөрийг шалгана уу.`,
          status: 400,
        };
      }
      if (!parsed.columns.current) {
        return {
          error: `«${sheet.name}» табад заалтын багана дутуу. «Заалт … сар» гэсэн ХОЁР багана (өмнөх, одоогийн) байх ёстой.`,
          status: 400,
        };
      }

      skipped.push(
        ...parsed.skipped.map((row) => ({ ...row, rowIndex: row.rowIndex + offset, sheet: sheet.name })),
      );

      for (const row of parsed.rows) {
        const rowIndex = row.rowIndex + offset;
        const flatId = flatIdByNumber.get(row.flatNumber);
        if (!flatId) {
          unknownFlats.push({ sheet: sheet.name, rowIndex, flatNumber: row.flatNumber });
          continue;
        }

        try {
          const bill = calculateElectricity(
            row,
            resolveTariffs(tariffs, sheetEntrance ?? entranceByFlatId.get(flatId) ?? null),
          );
          valid.push({
            rowIndex,
            sheet: sheet.name,
            entrance: sheetEntrance,
            flatNumber: row.flatNumber,
            flatId,
            prevReading: row.prev,
            currentReading: row.current,
            // Тооцоонд орсон кВт·ц (алдагдлын коэфф хэрэглэсний дараах)
            usageAmount: bill.billedKwh,
            billAmount: bill.total,
            // Админ зөвшөөрсөн эмзэг мөр бол ШАЛТГААНЫГ үлдээнэ
            note: row.forcedNote ?? null,
            isReplacing: existingFlatIds.has(flatId),
            breakdown: bill.lines,
          });
        } catch (error) {
          skipped.push({
            sheet: sheet.name,
            rowIndex,
            raw: String(row.flatNumber),
            reason: error instanceof ElectricityError ? error.message : 'Бодоход алдаа гарлаа',
          });
        }
      }
    } else {
      // ── Бусад ангилал (СӨХ): Excel дээрх бэлэн "Дүн" ─────────────────────
      const parsed = parseInvoices(sheet.rows, validFlats);
      if (!columns.flat) columns = parsed.columns as Record<string, string | undefined>;

      if (!parsed.columns.flat || !parsed.columns.amount) {
        return {
          error: `«${sheet.name}» табад "Тоот" эсвэл "Дүн" багана олдсонгүй. Файлын толгой мөрийг шалгана уу.`,
          status: 400,
        };
      }

      skipped.push(
        ...parsed.skipped.map((row) => ({ ...row, rowIndex: row.rowIndex + offset, sheet: sheet.name })),
      );

      for (const row of parsed.rows) {
        const rowIndex = row.rowIndex + offset;
        const flatId = flatIdByNumber.get(row.flatNumber);
        if (!flatId) {
          unknownFlats.push({ sheet: sheet.name, rowIndex, flatNumber: row.flatNumber });
          continue;
        }
        valid.push({
          rowIndex,
          sheet: sheet.name,
          entrance: sheetEntrance,
          flatNumber: row.flatNumber,
          flatId,
          prevReading: row.prevReading,
          currentReading: row.currentReading,
          usageAmount: row.usageAmount,
          billAmount: row.billAmount,
          note: row.note,
          isReplacing: existingFlatIds.has(flatId),
        });
      }
    }

    sheetSummary.push({
      name: sheet.name,
      rows: sheet.rows.length,
      imported: valid.length - before,
    });
  }

  // ── Хоёр табад ижил тоот байвал АНХААРУУЛНА ───────────────────────────────
  // Нэг тоот хоёр орцод байх боломжгүй. Байвал хүснэгт эвдэрсэн эсвэл
  // хуулсан мөр байна — аль нь зөв бэ гэдгийг систем шийдэхгүй.
  const sheetsByFlat = new Map<number, Set<string>>();
  for (const row of valid) {
    (sheetsByFlat.get(row.flatNumber) ?? sheetsByFlat.set(row.flatNumber, new Set()).get(row.flatNumber)!).add(
      row.sheet,
    );
  }
  const duplicateFlats = [...sheetsByFlat.entries()]
    .filter(([, names]) => names.size > 1)
    .map(([flatNumber, names]) => ({ flatNumber, sheets: [...names] }));

  return {
    category: cat,
    billingMonth,
    columns,
    tariffs,
    valid,
    unknownFlats,
    skipped,
    duplicateFlats,
    sheetSummary,
    totalAmount: valid.reduce((sum, row) => sum + row.billAmount, 0),
  };
}

export function isImportError(
  result: InvoiceImportAnalysis | InvoiceImportError,
): result is InvoiceImportError {
  return 'error' in result;
}
