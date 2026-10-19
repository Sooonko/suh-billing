import { detectColumns, parseAmount, parseDate, rowAmounts, type RawRow } from '@/lib/matching/parse-statement';

/**
 * Улсын байгууллага руу ШИЛЖҮҮЛСЭН мөнгө — СӨХ айлуудаас цуглуулсан
 * төлбөрөө цааш нь төлдөг. Зөвхөн админы хяналтад харагдана.
 *
 * Хоёр эх сурвалжтай:
 *   1. Банкны хуулгын ЗАРЛАГЫН мөр — гүйлгээний утган дахь кодоор таниа.
 *      Код байхгүй зарлага (шимтгэл, цалин г.м) огт бүртгэгдэхгүй.
 *   2. Админы гараар хөтөлсөн Excel («Шилжүүлсэн баримт») — өмнөх түүх.
 */

export type TransferRecipient = 'UBCTS' | 'USUG' | 'UB_HEAT';

export const RECIPIENTS: {
  key: TransferRecipient;
  label: string;
  /**
   * Улсын данс руу шилжүүлэхэд гүйлгээний утганд ЗААВАЛ бичдэг код
   * (байгууллагаас өгсөн хэрэглэгчийн дугаар).
   */
  code: string;
}[] = [
  { key: 'UBCTS', label: 'УБЦТС (цахилгаан)', code: '4044820' },
  { key: 'USUG', label: 'УСУГ (ус суваг)', code: '25010490' },
  { key: 'UB_HEAT', label: 'УБ Дулааны сүлжээ', code: '11619' },
];

export const RECIPIENT_LABEL = Object.fromEntries(RECIPIENTS.map((r) => [r.key, r.label])) as Record<
  TransferRecipient,
  string
>;

/**
 * Кодыг ТУСДАА тоо байхад л таниа — «11619» нь урт дансны дугаар, дүн
 * дотор санамсаргүй таарч болно («2116190» г.м).
 */
const CODE_PATTERNS = RECIPIENTS.map((r) => ({ key: r.key, re: new RegExp(`(?<!\\d)${r.code}(?!\\d)`) }));

/** Гүйлгээний утгаас хүлээн авагчийг кодоор нь таниа. Кодгүй бол null. */
export function recipientFromDescription(description: string): TransferRecipient | null {
  return CODE_PATTERNS.find((p) => p.re.test(description))?.key ?? null;
}

/** Excel-ийн «Хаана» баганаас — «УБЦТС», «Ус сувгийн удирдах газар», «УБ дулааны сүлжээ» */
export function recipientFromName(name: string): TransferRecipient | null {
  const n = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (n.includes('цтс') || n.includes('цахилгаан')) return 'UBCTS';
  // «Ус сувгийн удирдах газар» — «суваг» биш «сувг-» (эгшиг гээгдэнэ)
  if (/ус ?сув/.test(n) || n.includes('усуг')) return 'USUG';
  if (n.includes('дулаан')) return 'UB_HEAT';
  return null;
}

/**
 * Давхардлын түлхүүр — хүлээн авагч + огноо + дүн.
 *
 * Гүйлгээний утга ОРОЛЦОХГҮЙ: нэг шилжүүлэг хуулгад «4044820 …» гэж,
 * гараар хөтөлсөн Excel-д «УБЦТС» гэж өөр бичигддэг. Хоёуланг оруулахад
 * нэг л удаа бүртгэгдэх ёстой.
 */
export function transferKey(t: { recipient: TransferRecipient; transferDate: string; amount: number }): string {
  return `${t.recipient}|${t.transferDate}|${t.amount.toFixed(2)}`;
}

export interface NewTransfer {
  /** Excel дээрх мөрийн дугаар (1-ээс) — админд тайлагнана */
  rowIndex: number;
  recipient: TransferRecipient;
  /** 'YYYY-MM-DD' — хуанлийн өдөр */
  transferDate: string;
  amount: number;
  description: string;
  /** Тусгай тэмдэглэл — жишээ «Орхоны шугуй ХХК-ийн өрөнд айлуудаас» */
  note: string | null;
}

/**
 * Огноог 'YYYY-MM-DD' болгох.
 *
 * ⚠️ Date объектыг ОРОН НУТГИЙН бүрэлдэхүүнээр уншина. SheetJS Excel-ийн
 * огноог браузерын бүсээр Date болгодог — «2025-08-28» нүд UTC+8 дээр
 * `2025-08-27T16:00:00Z` болдог тул toISOString() нэг өдөр ХОЦРООНО.
 * Браузер огноог ингэж хөрвүүлээд серверт мөр хэлбэрээр илгээнэ.
 */
export function toDateOnly(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    // Excel serial — 1899-12-30-аас хойших өдөр. Бүсгүй тул UTC-ээр бодно.
    return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4})[-./](\d{2})[-./](\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return null;
}

/** Сараалжийн Date нүдийг 'YYYY-MM-DD' мөр болгоно — серверт илгээхийн өмнө */
export function serializeGrid(grid: unknown[][]): unknown[][] {
  return grid.map((row) => row.map((cell) => (cell instanceof Date ? toDateOnly(cell) : cell)));
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface LedgerResult {
  transfers: NewTransfer[];
  skipped: { rowIndex: number; text: string; reason: string }[];
  /** Олдсон блокуудын тоо — 0 бол файлын бүтэц таарахгүй */
  blocks: number;
}

/**
 * Гараар хөтөлсөн «Шилжүүлсэн баримт» Excel-ийг задлах.
 *
 * Бүтэц: нэг хуудсанд ХАЖУУ ХАЖУУГААР хэд хэдэн блок —
 *
 *   № | Огноо | Хаана | Мөнгөн дүн |   | № | Огноо | Хаана | Мөнгөн дүн | …
 *
 * Блок бүрийг «Огноо · Хаана · …дүн» гэсэн гурван дараалсан толгой нүдээр
 * олно. Толгой нь заавал 1-р мөрөнд биш — блокийн ДЭЭР гарчиг байвал
 * (жишээ «Орхоны шугуй ХХК-ийн ӨРӨНД АЙЛУУДААС») тэр нь тухайн блокийн
 * шилжүүлэг бүрийн тэмдэглэл болно.
 *
 * Огноо эсвэл дүн нь хоосон мөр («Нийт:», бөглөөгүй мөр) алгасагдана.
 */
export function parseTransferLedger(grid: unknown[][]): LedgerResult {
  const blocks: { headerRow: number; col: number; note: string | null }[] = [];

  for (let r = 0; r < Math.min(grid.length, 10); r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (norm(row[c]) !== 'огноо') continue;
      if (!norm(row[c + 1]).startsWith('хаана') || !norm(row[c + 2]).includes('дүн')) continue;

      // Блокийн дээрх мөрөнд (№ баганаас эхлэн) бичсэн гарчиг
      const above = r > 0 ? grid[r - 1] ?? [] : [];
      const title = [c - 1, c, c + 1, c + 2]
        .map((i) => String(above[i] ?? '').trim())
        .find((text) => text !== '');
      blocks.push({ headerRow: r, col: c, note: title ?? null });
    }
  }

  const transfers: NewTransfer[] = [];
  const skipped: LedgerResult['skipped'] = [];

  for (const block of blocks) {
    for (let r = block.headerRow + 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const rawDate = row[block.col];
      const name = String(row[block.col + 1] ?? '').trim();
      const rawAmount = row[block.col + 2];
      if (String(rawDate ?? '').trim() === '' && name === '' && String(rawAmount ?? '').trim() === '') continue;

      const rowIndex = r + 1;
      const date = toDateOnly(rawDate);
      const amount = parseAmount(rawAmount);
      const recipient = recipientFromName(name);

      // «Нийт:», «Цахилгаан тушаасан нийт мөнгө:» — нийлбэрийн мөр
      if (/нийт/i.test(name)) continue;
      // Дугаарлаад бөглөөгүй мөр — тайлагнахгүй
      if (!date && amount <= 0) continue;

      const text = [name, String(rawAmount ?? '')].filter(Boolean).join(' · ');
      if (!date) {
        skipped.push({ rowIndex, text, reason: 'Огноо байхгүй' });
        continue;
      }
      if (amount <= 0) {
        skipped.push({ rowIndex, text, reason: 'Дүн байхгүй' });
        continue;
      }
      if (!recipient) {
        skipped.push({ rowIndex, text, reason: 'Хүлээн авагч танигдсангүй' });
        continue;
      }

      transfers.push({ rowIndex, recipient, transferDate: date, amount, description: name, note: block.note });
    }
  }

  return { transfers, skipped, blocks: blocks.length };
}

/**
 * Банкны хуулгын ЗАРЛАГЫН мөрөөс улсын байгууллагын шилжүүлгийг ялгах.
 *
 * Гүйлгээний утганд байгууллагын код (`RECIPIENTS[].code`) байгаа мөрийг
 * л авна. Бусад зарлага (шимтгэл, буцаалт, цалин) — хамаагүй.
 *
 * `parseStatement` ОРЛОГЫГ, энэ функц ЗАРЛАГЫГ уншина — хоёулаа ижил
 * толгой таних, огноо унших дүрэмтэй.
 */
export function extractStatementTransfers(rows: RawRow[]): NewTransfer[] {
  const columns = detectColumns(rows.length ? Object.keys(rows[0]) : []);
  const transfers: NewTransfer[] = [];

  for (const [index, row] of rows.entries()) {
    const { debit } = rowAmounts(row, columns);
    if (debit <= 0) continue;

    const description = String(columns.description ? (row[columns.description] ?? '') : '').trim();
    const recipient = recipientFromDescription(description);
    if (!recipient) continue;

    // parseDate бүсгүй утгыг UTC гэж уншдаг тул эхний 10 тэмдэгт нь
    // хуулга дээр бичигдсэн хуанлийн өдөр
    const iso = columns.date ? parseDate(row[columns.date]) : null;
    if (!iso) continue;

    transfers.push({
      rowIndex: index + 2,
      recipient,
      transferDate: iso.slice(0, 10),
      amount: debit,
      description,
      note: null,
    });
  }

  return transfers;
}

/**
 * Аль шилжүүлэг DB-д аль хэдийн байгааг тэмдэглэх — ТООГООР нь.
 *
 * Нэг өдөр ижил дүнгээр хоёр удаа шилжүүлэх жинхэнэ тохиолдол бий (Excel-д
 * 2025-12-25-нд дулаан руу 900,000₮ хоёр удаа). Тиймээс «түлхүүр байвал
 * давхардсан» гэж болохгүй: DB-д 1, файлд 2 байвал НЭГ нь шинэ.
 *
 * @param existing  DB дахь шилжүүлгүүдийн `transferKey` (давхардалтай)
 * @returns         `incoming`-тэй ижил урттай — true бол аль хэдийн бүртгэгдсэн
 */
export function markDuplicateTransfers(
  incoming: Pick<NewTransfer, 'recipient' | 'transferDate' | 'amount'>[],
  existing: string[],
): boolean[] {
  const remaining = new Map<string, number>();
  for (const key of existing) remaining.set(key, (remaining.get(key) ?? 0) + 1);

  return incoming.map((t) => {
    const key = transferKey(t);
    const left = remaining.get(key) ?? 0;
    if (left === 0) return false;
    remaining.set(key, left - 1);
    return true;
  });
}
