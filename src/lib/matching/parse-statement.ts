import { matchFlat, type Confidence, type NameIndex } from './parse-flat';

/**
 * Банкны хуулгын мөрүүдийг систем ойлгох хэлбэрт оруулах.
 *
 * Excel файлыг БРАУЗЕР дээр SheetJS-ээр уншаад, зөвхөн энэ JSON-ыг сервер рүү
 * илгээнэ. Ингэснээр Vercel-ийн 10 секундын хязгаарт огт ойртохгүй.
 */

/** Хуулгын түүхий мөр — SheetJS-ийн sheet_to_json гаралт */
export type RawRow = Record<string, unknown>;

/** Баганын нэрийн боломжит хувилбарууд (банк болгон өөр бичдэг) */
const COLUMNS = {
  date: ['гүйлгээний огноо', 'огноо', 'date', 'trn date', 'гүйлгээ хийсэн огноо'],
  debit: ['зарлага', 'debit', 'дебит'],
  credit: ['орлого', 'credit', 'кредит'],
  closing: ['эцсийн үлдэгдэл', 'үлдэгдэл', 'balance', 'closing balance'],
  description: ['гүйлгээний утга', 'утга', 'гүйлгээний тайлбар', 'description', 'narrative'],
  counterparty: ['харьцсан данс', 'харьцсан дансны дугаар', 'account', 'counterparty'],
  /**
   * Зарим банк орлого/зарлагыг ТУСГААРЛАЛГҮЙ нэг баганад бичдэг —
   * зарлага нь сөрөг тоо. Орлого/Зарлага багана олдоогүй үед л энийг
   * хэрэглэнэ (доорх parseStatement-ыг үзнэ үү).
   */
  amount: ['гүйлгээний дүн', 'дүн', 'amount'],
} as const;

type ColumnKey = keyof typeof COLUMNS;

/**
 * Хуулгын толгой мөрөөс багана бүрийг олох.
 *
 * Хоёр дүрэм:
 *  1. ЯГ тэнцүү тохирлыг эхэлж шалгана, дараа нь л хэсэгчилсэнийг.
 *     "Орлогын дүн" гэдэг нь 'орлого' ба 'дүн' ХОЁУЛАНД нь тохирно.
 *  2. Нэг баганыг хоёр түлхүүрт оноохгүй — эзэмшсэн баганыг тэмдэглэнэ.
 *     Үүнгүйгээр "Орлогын дүн" нь credit ба amount хоёулаа болж,
 *     зарлага ялгах логик эвдэрнэ.
 */
export function detectColumns(headers: string[]): Partial<Record<ColumnKey, string>> {
  const map: Partial<Record<ColumnKey, string>> = {};
  const taken = new Set<string>();
  const normalized = headers.map((h) => [h, h.toLowerCase().trim().replace(/\s+/g, ' ')] as const);

  for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
    const aliases: readonly string[] = COLUMNS[key];

    const exact = normalized.find(([original, h]) => !taken.has(original) && aliases.some((a) => h === a));
    const hit =
      exact ?? normalized.find(([original, h]) => !taken.has(original) && aliases.some((a) => h.includes(a)));

    if (hit) {
      map[key] = hit[0];
      taken.add(hit[0]);
    }
  }

  return map;
}

/** "44,239.00" · " 1 200 " · 44239 → 44239 */
export function parseAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/[^\d.-]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** "2026-08-01T12:07:03" эсвэл Excel-ийн серийн дугаар → ISO огноо */
export function parseDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    // Excel-ийн serial date: 1899-12-30-аас хойших өдрийн тоо
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value !== 'string') return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Давхардал таних түлхүүр. Нэг хуулгыг 100 удаа оруулсан ч давхардахгүй. */
export async function dedupeHash(parts: {
  date: string;
  amount: number;
  description: string;
  closingBalance: number | null;
}): Promise<string> {
  const input = [parts.date, parts.amount.toFixed(2), parts.description.trim(), parts.closingBalance ?? ''].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ParsedTransaction {
  rowIndex: number;
  txnDate: string;
  amount: number;
  description: string;
  counterpartyAccount: string | null;
  closingBalance: number | null;
  dedupeHash: string;
  /** Таасан тоот. null бол гар шалгалт руу. */
  flatNumber: number | null;
  confidence: Confidence;
  candidates: number[];
  reason?: string;
}

/** Алгасагдсан мөрийн шалтгаан — админд тайлагнана */
export interface SkippedRow {
  rowIndex: number;
  description: string;
  reason: string;
}

export interface ParseStatementResult {
  transactions: ParsedTransaction[];
  skipped: SkippedRow[];
  columns: Partial<Record<ColumnKey, string>>;
}

/**
 * Хуулгын бүх мөрийг боловсруулна.
 *
 * ЧУХАЛ ДҮРЭМ: зөвхөн ОРЛОГО-ын мөрийг авна.
 * Зарлага (шимтгэл, шилжүүлэг, буцаалт) бүрэн алгасана.
 */
export async function parseStatement(
  rows: RawRow[],
  validFlats: ReadonlySet<number>,
  /** Арилжааны хэсгүүдийг нэрээр таних индекс (`buildNameIndex`) */
  nameIndex?: NameIndex,
): Promise<ParseStatementResult> {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = detectColumns(headers);

  const transactions: ParsedTransaction[] = [];
  const skipped: SkippedRow[] = [];

  for (const [index, row] of rows.entries()) {
    const rowIndex = index + 2; // Excel дээрх мөрийн дугаар (1 нь толгой)
    const description = String(columns.description ? (row[columns.description] ?? '') : '').trim();

    // Орлого/Зарлага тусдаа багана байвал тэрийг, үгүй бол нэг баганын
    // ТЭМДГЭЭР ялгана (эерэг = орлого, сөрөг = зарлага).
    const hasSplitColumns = Boolean(columns.credit || columns.debit);
    const signed = !hasSplitColumns && columns.amount ? parseAmount(row[columns.amount]) : 0;

    const credit = hasSplitColumns
      ? columns.credit
        ? parseAmount(row[columns.credit])
        : 0
      : Math.max(signed, 0);
    const debit = hasSplitColumns
      ? columns.debit
        ? parseAmount(row[columns.debit])
        : 0
      : Math.max(-signed, 0);

    // ── Зарлага мөрийг бүрэн алгасана ────────────────────────────────────────
    if (credit <= 0) {
      skipped.push({
        rowIndex,
        description,
        reason: debit > 0 ? 'Зарлагын гүйлгээ' : 'Орлогын дүн байхгүй',
      });
      continue;
    }

    const txnDate = columns.date ? parseDate(row[columns.date]) : null;
    if (!txnDate) {
      skipped.push({ rowIndex, description, reason: 'Огноо уншигдсангүй' });
      continue;
    }

    const closingBalance = columns.closing ? parseAmount(row[columns.closing]) || null : null;
    const match = matchFlat(description, validFlats, nameIndex);

    transactions.push({
      rowIndex,
      txnDate,
      amount: credit,
      description,
      counterpartyAccount: columns.counterparty ? String(row[columns.counterparty] ?? '').trim() || null : null,
      closingBalance,
      dedupeHash: await dedupeHash({ date: txnDate, amount: credit, description, closingBalance }),
      flatNumber: match.flatNumber,
      confidence: match.confidence,
      candidates: match.candidates,
      reason: match.reason,
    });
  }

  return { transactions, skipped, columns };
}
