/**
 * Админы жагсаалтын хуудаслалт.
 *
 * ЯАГААД: «Баримт» хуудас 1000 гүйлгээг нэг дор зурдаг байв — мөр бүр
 * өөрийн товчтой (client component) тул хөтөч мянган товчийг сэргээх
 * гэж удаашралтай. Анхдагчаар 10 мөр харуулж, хүсвэл 50/100/200 болгоно.
 *
 * Хуудас ба хэмжээ нь URL-д (`?page=3&size=50`) — сэргээх, хуваалцах,
 * буцах товч дарахад алдагдахгүй.
 *
 * ⚠️ ДҮН, ТООЛОЛТ, EXCEL нь ХУУДАС БИШ, БҮХ шүүсэн мөрөөр бодогдоно.
 * Хуудаслалт нь зөвхөн ДЭЛГЭЦЭД зурах мөрийг хязгаарладаг.
 */

export const PAGE_SIZES = [10, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 10;

export interface Paging {
  /** 1-ээс эхэлнэ */
  page: number;
  size: number;
}

export interface Page<T> extends Paging {
  rows: T[];
  /** Шүүлтийн дараах НИЙТ мөр */
  total: number;
  pageCount: number;
  /** Дэлгэцэнд «11–20 / 1,234» гэж харуулахад — 1-ээс эхэлсэн */
  from: number;
  to: number;
}

/** URL-ын утгыг шалгаж уншина — буруу утга ирвэл анхдагч руу буцна */
export function parsePaging(params: { page?: string | string[]; size?: string | string[] }): Paging {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const sizeRaw = Number(one(params.size));
  const size = (PAGE_SIZES as readonly number[]).includes(sizeRaw) ? sizeRaw : DEFAULT_PAGE_SIZE;

  const pageRaw = Number(one(params.page));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  return { page, size };
}

/**
 * Хуудасны мэдээллийг тооцно.
 *
 * Хуудас хэтэрсэн бол (жишээ нь 9-р хуудсан дээр байхад шүүлт хийж 3
 * хуудас үлдсэн) СҮҮЛИЙН хуудас руу шилжүүлнэ — хоосон дэлгэц харуулахгүй.
 */
export function pageInfo(total: number, paging: Paging): Omit<Page<never>, 'rows'> {
  const pageCount = Math.max(1, Math.ceil(total / paging.size));
  const page = Math.min(paging.page, pageCount);
  const start = (page - 1) * paging.size;
  return {
    page,
    size: paging.size,
    total,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + paging.size, total),
  };
}

/** Санах ойд байгаа массивыг хуудаслана */
export function paginate<T>(rows: T[], paging: Paging): Page<T> {
  const info = pageInfo(rows.length, paging);
  return { ...info, rows: rows.slice(info.from === 0 ? 0 : info.from - 1, info.to) };
}

/**
 * Хуудасны дугааруудын жагсаалт — олон хуудастай үед «…»-аар товчилно.
 *
 *   pageNumbers(1, 3)   → [1, 2, 3]
 *   pageNumbers(6, 20)  → [1, '…', 5, 6, 7, '…', 20]
 */
export function pageNumbers(current: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

  const pages = new Set([1, count, current - 1, current, current + 1]);
  // Эхэн, төгсгөлд ойр бол «…»-ын оронд дугаар харуулна — «1 … 3» гэх нь утгагүй
  if (current <= 4) [2, 3, 4, 5].forEach((p) => pages.add(p));
  if (current >= count - 3) [count - 4, count - 3, count - 2, count - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (typeof last === 'number' && p - last > 1) out.push('…');
    out.push(p);
  }
  return out;
}
