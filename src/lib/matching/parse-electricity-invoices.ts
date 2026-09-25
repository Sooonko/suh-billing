import type { FlatResolver } from './parse-water-invoices';
import { parseAmount } from './parse-statement';

/**
 * Цахилгааны нэхэмжлэлийн Excel-ийг задлан шинжлэх.
 *
 * Нэг тоолуур, хоёр заалт. Уснытай адил ⚠️ баганын нэрэнд САР бичигдсэн
 * байдаг («Заалт 8 сар», «Заалт 9 сар») бөгөөд сар бүр өөрчлөгддөг тул
 * нэрээр биш БАЙРЛАЛААР ялгана: «заалт» агуулсан эхний багана нь өмнөх,
 * хоёр дахь нь одоогийнх.
 *
 * Бодогдсон багануудыг (зөрүү, квт.цаг, чад.төлбөр, НӨАТ, нийт) УНШИХГҮЙ —
 * системээ өөрөө бодно.
 */

export type RawRow = Record<string, unknown>;

export interface ElectricityColumns {
  flat?: string;
  prev?: string;
  current?: string;
}

const norm = (header: string) => header.toLowerCase().replace(/\s+/g, ' ').trim();

export function detectElectricityColumns(headers: string[]): ElectricityColumns {
  const columns: ElectricityColumns = {};

  // «№» багана эхэнд байдаг тул ЯГ «тоот»-ыг хайна, эхлэлийн тохирол биш
  columns.flat =
    headers.find((h) => norm(h) === 'тоот') ?? headers.find((h) => norm(h).startsWith('тоот'));

  const readings = headers.filter((h) => norm(h).includes('заалт'));
  [columns.prev, columns.current] = readings;

  return columns;
}

export interface ParsedElectricityRow {
  rowIndex: number;
  flatNumber: number;
  prev: number;
  current: number;
  /**
   * Админ ЗӨВШӨӨРСӨН тул оруулсан эмзэг мөр — нэхэмжлэлийн `note` болно.
   */
  forcedNote?: string;
}

export interface ParseElectricityResult {
  rows: ParsedElectricityRow[];
  /** `canInclude` — админ зөвшөөрч болох эмзэг мөр (заалт дутуу) */
  skipped: { rowIndex: number; raw: string; reason: string; canInclude?: boolean }[];
  columns: ElectricityColumns;
}

function reading(row: RawRow, column: string | undefined): number | null {
  if (!column) return null;
  const value = row[column];
  if (value === null || value === undefined || value === '') return null;
  const n = parseAmount(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param forceRows Админ «оруул» гэж зөвшөөрсөн мөрийн дугаарууд. Заалт
 *                  дутуу байсан ч зарцуулалтыг 0 гэж үзэж оруулна.
 *                  Шийдвэрийг СИСТЕМ биш, ХҮН гаргана.
 */
export function parseElectricityInvoices(
  rows: RawRow[],
  resolve: FlatResolver,
  forceRows?: ReadonlySet<number>,
): ParseElectricityResult {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = detectElectricityColumns(headers);

  const parsed: ParsedElectricityRow[] = [];
  const skipped: ParseElectricityResult['skipped'] = [];

  for (const [index, row] of rows.entries()) {
    const rowIndex = index + 2;
    const raw = columns.flat ? String(row[columns.flat] ?? '').trim() : '';

    const flatNumber = resolve(raw);
    if (flatNumber === null) {
      const isBlank = Object.values(row).every((v) => v === null || v === undefined || v === '');
      if (!isBlank) skipped.push({ rowIndex, raw, reason: 'Тоот танигдсангүй' });
      continue;
    }

    const prev = reading(row, columns.prev);
    const current = reading(row, columns.current);

    // Уснытай ижил дүрэм: одоогийн заалт хоосон = дата ОРУУЛААГҮЙ.
    // Дуугүй 0 болговол сөрөг зарцуулалт гарч, төлбөр утгагүй болно.
    if (current === null) {
      if (prev === null) {
        // Хоёулаа хоосон — тоолуургүй / хүнгүй. Зарцуулалт 0.
        parsed.push({ rowIndex, flatNumber, prev: 0, current: 0 });
        continue;
      }
      const reason = 'ЭНЭ САРЫН заалт бөглөгдөөгүй';
      if (!forceRows?.has(rowIndex)) {
        skipped.push({ rowIndex, raw, reason, canInclude: true });
        continue;
      }
      // Админ зөвшөөрсөн: өмнөх заалтыг давтаж зарцуулалтыг 0 болгоно
      parsed.push({
        rowIndex,
        flatNumber,
        prev,
        current: prev,
        forcedNote: `${reason} — админ зөвшөөрч, зарцуулалтыг 0 гэж үзсэн`,
      });
      continue;
    }

    parsed.push({ rowIndex, flatNumber, prev: prev ?? 0, current });
  }

  return { rows: parsed, skipped, columns };
}
