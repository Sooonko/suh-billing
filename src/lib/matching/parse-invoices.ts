import { parseAmount } from './parse-statement';

/**
 * Сарын нэхэмжлэлийн Excel-ийг задлан шинжлэх.
 *
 * Хуулгын задлагчаас (parse-statement.ts) ӨӨР: энд тоот таах шаардлагагүй —
 * нэхэмжлэлийн файл дээр тоот нь өөрийн багананд цэвэр байдаг. Тиймээс
 * regex таамаглал биш, зүгээр л уншина.
 *
 * Excel-ийг БРАУЗЕР дээр SheetJS-ээр уншиж, түүхий мөрийг сервер рүү илгээнэ.
 */

export type RawRow = Record<string, unknown>;

/** Баганын нэрийн боломжит хувилбарууд — СӨХ болгон өөрөөр бичдэг */
const COLUMNS = {
  flat: ['тоот', 'айл', 'flat', 'тоотын дугаар', 'хаалга'],
  prev: ['өмнөх заалт', 'өмнөх', 'эхний заалт', 'prev', 'previous'],
  current: ['одоогийн заалт', 'одоо', 'эцсийн заалт', 'шинэ заалт', 'current'],
  usage: ['зарцуулалт', 'хэрэглээ', 'зөрүү', 'usage'],
  amount: ['дүн', 'төлбөр', 'нэхэмжлэл', 'нийт', 'amount', 'total'],
  note: ['тайлбар', 'note', 'нэмэлт'],
} as const;

type ColumnKey = keyof typeof COLUMNS;

/**
 * Толгой мөрөөс багана бүрийг олох.
 *
 * ⚠️ Дараалал чухал: "дүн" гэдэг нь "зарцуулалтын дүн" гэсэн гарчигт ч
 * агуулагдана. Тиймээс ЯГ тэнцүү тохирлыг эхэлж шалгаж, дараа нь л
 * хэсэгчилсэн тохирол авна.
 */
export function detectColumns(headers: string[]): Partial<Record<ColumnKey, string>> {
  const map: Partial<Record<ColumnKey, string>> = {};
  const normalized = headers.map((h) => [h, h.toLowerCase().trim().replace(/\s+/g, ' ')] as const);

  for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
    const aliases = COLUMNS[key];
    const exact = normalized.find(([, h]) => aliases.some((a) => h === a));
    if (exact) {
      map[key] = exact[0];
      continue;
    }
    const partial = normalized.find(
      ([original, h]) => aliases.some((a) => h.includes(a)) && !Object.values(map).includes(original),
    );
    if (partial) map[key] = partial[0];
  }

  return map;
}

export interface ParsedInvoiceRow {
  /** Excel дээрх мөрийн дугаар — админд алдаа хэлэхэд хэрэгтэй */
  rowIndex: number;
  flatNumber: number;
  prevReading: number | null;
  currentReading: number | null;
  usageAmount: number | null;
  billAmount: number;
  note: string | null;
  /** flats хүснэгтэд байгаа эсэх */
  isKnownFlat: boolean;
}

export interface SkippedInvoiceRow {
  rowIndex: number;
  raw: string;
  reason: string;
}

export interface ParseInvoicesResult {
  rows: ParsedInvoiceRow[];
  skipped: SkippedInvoiceRow[];
  columns: Partial<Record<ColumnKey, string>>;
}

/** Хоосон / тэг биш тоо эсэхийг шалгаад тоо болгоно */
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = parseAmount(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Бүх мөрийг боловсруулна.
 *
 * ДҮРЭМ: тоот уншигдаагүй эсвэл дүн сөрөг мөрийг бүртгэхгүй — алгасаад
 * шалтгааныг тайлагнана. Дуугүй хаяхгүй, админ бүх мөрийн тоог тааруулж
 * чадах ёстой.
 */
export function parseInvoices(
  rows: RawRow[],
  validFlats: ReadonlySet<number>,
): ParseInvoicesResult {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = detectColumns(headers);

  const parsed: ParsedInvoiceRow[] = [];
  const skipped: SkippedInvoiceRow[] = [];

  for (const [index, row] of rows.entries()) {
    const rowIndex = index + 2; // Excel дээрх мөр (1 нь толгой)
    const raw = columns.flat ? String(row[columns.flat] ?? '').trim() : '';

    const flatNumber = columns.flat ? Number.parseInt(raw.replace(/\D/g, ''), 10) : NaN;
    if (!Number.isInteger(flatNumber) || flatNumber <= 0) {
      // Бүрэн хоосон мөрийг чимээгүй алгасна (Excel-ийн сүүл хоосон мөрүүд)
      const isBlank = Object.values(row).every((v) => v === null || v === undefined || v === '');
      if (!isBlank) skipped.push({ rowIndex, raw, reason: 'Тоот уншигдсангүй' });
      continue;
    }

    const billAmount = columns.amount ? parseAmount(row[columns.amount]) : 0;
    if (!Number.isFinite(billAmount) || billAmount < 0) {
      skipped.push({ rowIndex, raw, reason: 'Дүн буруу' });
      continue;
    }

    const prevReading = columns.prev ? optionalNumber(row[columns.prev]) : null;
    const currentReading = columns.current ? optionalNumber(row[columns.current]) : null;
    let usageAmount = columns.usage ? optionalNumber(row[columns.usage]) : null;

    // Зарцуулалтын багана байхгүй ч заалт хоёулаа байвал өөрсдөө бодно
    if (usageAmount === null && prevReading !== null && currentReading !== null) {
      usageAmount = Number((currentReading - prevReading).toFixed(2));
    }

    parsed.push({
      rowIndex,
      flatNumber,
      prevReading,
      currentReading,
      usageAmount,
      billAmount,
      note: columns.note ? String(row[columns.note] ?? '').trim() || null : null,
      isKnownFlat: validFlats.has(flatNumber),
    });
  }

  return { rows: parsed, skipped, columns };
}
