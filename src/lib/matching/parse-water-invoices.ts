import { parseAmount } from './parse-statement';

/**
 * Ус дулааны нэхэмжлэлийн Excel-ийг задлан шинжлэх.
 *
 * Бусад ангиллаас ЯЛГААТАЙ: энд хоёр тоолуур (халуун, хүйтэн) тус бүр
 * өмнөх ба одоогийн заалттай — нийт 4 багана.
 *
 * ⚠️ Баганын нэрэнд САР бичигдсэн байдаг:
 *      «Халуун ус 8 сар заалт» · «Халуун ус 9 сар заалт»
 *    Сар бүр өөрчлөгддөг тул нэрээр нь хатуу таних БОЛОМЖГҮЙ.
 *    Тиймээс «халуун» + «заалт» агуулсан багануудыг олоод, хүснэгт дэх
 *    ДАРААЛЛААР нь эхнийхийг өмнөх, хоёр дахийг одоогийн гэж авна.
 *
 * Бодогдсон багануудыг (зөрүү, нийт, төлбөр, НӨАТ) УНШИХГҮЙ — системээ
 * өөрөө бодно. «Халуун ус зөрүү» нь «заалт» үг агуулаагүй тул аяндаа
 * шүүгдэж гарна.
 */

export type RawRow = Record<string, unknown>;

export interface WaterColumns {
  flat?: string;
  hotPrev?: string;
  hotCurrent?: string;
  coldPrev?: string;
  coldCurrent?: string;
}

/** Толгойн нэрийг харьцуулахад бэлтгэх */
const norm = (h: string) => h.toLowerCase().replace(/\s+/g, ' ').trim();

export function detectWaterColumns(headers: string[]): WaterColumns {
  const columns: WaterColumns = {};

  columns.flat = headers.find((h) => {
    const n = norm(h);
    return n === 'тоот' || n === 'айл' || n.startsWith('тоот');
  });

  /** «халуун»/«хүйтэн» БА «заалт» хоёуланг агуулсан баганууд, дараалалаараа */
  const readings = (keyword: string) =>
    headers.filter((h) => {
      const n = norm(h);
      return n.includes(keyword) && n.includes('заалт');
    });

  const hot = readings('халуун');
  const cold = readings('хүйтэн');

  [columns.hotPrev, columns.hotCurrent] = hot;
  [columns.coldPrev, columns.coldCurrent] = cold;

  return columns;
}

export interface ParsedWaterRow {
  /** Excel дээрх мөрийн дугаар — админд алдаа хэлэхэд хэрэгтэй */
  rowIndex: number;
  flatNumber: number;
  hotPrev: number;
  hotCurrent: number;
  coldPrev: number;
  coldCurrent: number;
  /**
   * Админ ЗӨВШӨӨРСӨН тул оруулсан эмзэг мөр. Тайлбар нь нэхэмжлэлийн
   * `note` болж хадгалагдана — хожим «яагаад ингэж бодогдсон бэ» гэж
   * асуухад хариулт үлдэнэ.
   */
  forcedNote?: string;
}

export interface SkippedWaterRow {
  rowIndex: number;
  raw: string;
  reason: string;
  /**
   * Админ «оруул» гэж зөвшөөрч БОЛОХ уу.
   *
   * Заалт дутуу бол болно — зарцуулалтыг 0 гэж үзээд нэхэмжилнэ.
   * Тоот танигдаагүй бол БОЛОХГҮЙ — хэний төлбөр болох нь тодорхойгүй
   * тул чагтлах юм алга.
   */
  canInclude?: boolean;
}

export interface ParseWaterResult {
  rows: ParsedWaterRow[];
  skipped: SkippedWaterRow[];
  columns: WaterColumns;
}

/**
 * Нэг тоолуурын хос заалтыг уншина.
 *
 * Дөрвөн тохиолдлыг ЯЛГАНА — бүгдийг «дутуу» гэж хаявал жинхэнэ дата
 * оруулаагүйг нь олохгүй өнгөрнө:
 *
 *  1. Хоёулаа байгаа   → хэвийн
 *  2. Хоёулаа хоосон   → тоолуургүй / хүнгүй байр. Зарцуулалт 0, зөвхөн
 *                        тогтмол зардал нэхэмжилнэ.
 *  3. ӨМНӨХ хоосон     → админ зарцуулалтыг шууд бичсэн (Excel хоосныг 0
 *                        гэж үздэг). Өмнөхийг 0 гэж авна.
 *  4. ОДООГИЙН хоосон  → дата ОРУУЛААГҮЙ. Хүлээж авахгүй — эс бөгөөс
 *                        сөрөг зарцуулалт, сөрөг төлбөр гарна.
 *                        ГЭХДЭЭ админ тухайн мөрийг зөвшөөрвөл (`forceRows`)
 *                        зарцуулалтыг 0 гэж үзээд оруулна. Шийдвэрийг
 *                        СИСТЕМ биш, ХҮН гаргана.
 */
function meterPair(
  row: RawRow,
  prevColumn: string | undefined,
  currentColumn: string | undefined,
): { prev: number; current: number } | 'MISSING' {
  const prev = reading(row, prevColumn);
  const current = reading(row, currentColumn);

  if (current === null) return prev === null ? { prev: 0, current: 0 } : 'MISSING';
  return { prev: prev ?? 0, current };
}

/** Заалт нь заавал тоо байх ёстой — хоосон бол уншиж болохгүй */
function reading(row: RawRow, column: string | undefined): number | null {
  if (!column) return null;
  const value = row[column];
  if (value === null || value === undefined || value === '') return null;
  const n = parseAmount(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * «Тоот» нүдний агуулгыг тоот болгон хөрвүүлэгч.
 *
 * Гаднаас өгдөг болгосон шалтгаан: хүснэгтэд тоогоор бичигдээгүй мөрүүд
 * байдаг — «дэлгүүр», «amo sport», «өв соёл». Тэднийг flats хүснэгтийн
 * owner_name-тай тулгаж танина. Тэр логик нь DB-тэй холбоотой тул
 * задлагчийн дотор байх ёсгүй.
 *
 * null буцаавал мөр алгасагдана.
 */
export type FlatResolver = (raw: string) => number | null;

/**
 * @param forceRows Админ «оруул» гэж зөвшөөрсөн мөрийн дугаарууд
 *                  (`rowIndex`, өөрөөр хэлбэл толгойн дараа 2-оос эхэлнэ).
 *                  Заалт дутуу байсан ч зарцуулалтыг 0 гэж үзэж оруулна.
 */
export function parseWaterInvoices(
  rows: RawRow[],
  resolve: FlatResolver,
  forceRows?: ReadonlySet<number>,
): ParseWaterResult {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = detectWaterColumns(headers);

  const parsed: ParsedWaterRow[] = [];
  const skipped: SkippedWaterRow[] = [];

  for (const [index, row] of rows.entries()) {
    const rowIndex = index + 2; // толгойн дараах эхний мөр = 2
    const raw = columns.flat ? String(row[columns.flat] ?? '').trim() : '';

    const flatNumber = resolve(raw);
    if (flatNumber === null) {
      // Бүрэн хоосон мөрийг чимээгүй алгасна (Excel-ийн сүүл, "нийт" мөр л үлдэнэ)
      const isBlank = Object.values(row).every((v) => v === null || v === undefined || v === '');
      if (!isBlank) skipped.push({ rowIndex, raw, reason: 'Тоот танигдсангүй' });
      continue;
    }

    const hot = meterPair(row, columns.hotPrev, columns.hotCurrent);
    const cold = meterPair(row, columns.coldPrev, columns.coldCurrent);

    // Одоогийн заалт хоосон атлаа өмнөх нь байвал = дата ОРУУЛААГҮЙ.
    // Дуугүй 0 болговол сөрөг зарцуулалт гарч, төлбөр утгагүй болно.
    if (hot === 'MISSING' || cold === 'MISSING') {
      const which = [hot === 'MISSING' && 'халуун', cold === 'MISSING' && 'хүйтэн']
        .filter(Boolean)
        .join(', ');
      const reason = `${which} усны ЭНЭ САРЫН заалт бөглөгдөөгүй`;

      if (!forceRows?.has(rowIndex)) {
        skipped.push({ rowIndex, raw, reason, canInclude: true });
        continue;
      }

      // Админ зөвшөөрсөн: дутуу тоолуурыг «зарцуулалт 0» гэж үзнэ. Нөгөө
      // тоолуур нь хэвийн уншигдсан бол түүнийг нь бүрэн нэхэмжилнэ.
      const zeroUse = (m: typeof hot, prevColumn: string | undefined) => {
        if (m !== 'MISSING') return m;
        const prev = reading(row, prevColumn) ?? 0;
        return { prev, current: prev };
      };
      const hotFixed = zeroUse(hot, columns.hotPrev);
      const coldFixed = zeroUse(cold, columns.coldPrev);

      parsed.push({
        rowIndex,
        flatNumber,
        hotPrev: hotFixed.prev,
        hotCurrent: hotFixed.current,
        coldPrev: coldFixed.prev,
        coldCurrent: coldFixed.current,
        forcedNote: `${reason} — админ зөвшөөрч, зарцуулалтыг 0 гэж үзсэн`,
      });
      continue;
    }

    parsed.push({
      rowIndex,
      flatNumber,
      hotPrev: hot.prev,
      hotCurrent: hot.current,
      coldPrev: cold.prev,
      coldCurrent: cold.current,
    });
  }

  return { rows: parsed, skipped, columns };
}
