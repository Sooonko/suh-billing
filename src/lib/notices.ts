import { splitDebtByMonth, type InvoiceLine } from '@/lib/billing/fifo-debt';
import { hasDebt } from '@/lib/money';
import { CATEGORIES, type BillCategory } from '@/lib/types';

/**
 * Хаалганд наах төлбөрийн мэдэгдэл — нэг айлд нэг карт.
 *
 * ⚠️ 3 ангиллын НИЙТ дүнг ЗОРИУДААР гаргахгүй: ангилал бүр өөр дансанд
 * төлөгддөг тул нэгтгэсэн том тоо оршин суугчийг «юун их мөнгө вэ» гэж
 * төөрөлдүүлдэг. Ангилал бүр өөрийн дүнтэй.
 *
 * Өрийг `fifo-debt.ts`-ээр бодно — оршин суугчийн дэлгэц, админы «Айлууд»
 * дэлгэцтэй ижил дүрэм тул цаасан дээрх тоо дэлгэцийнхээс зөрөхгүй.
 */

export interface NoticeReadings {
  /** Цахилгаан: [өмнөх, одоо]. Ус дулаанд null. */
  meter: [number | null, number | null] | null;
  hot: [number | null, number | null] | null;
  cold: [number | null, number | null] | null;
  /** кВт·ц эсвэл м³ */
  usage: number | null;
}

export interface NoticeCategory {
  category: BillCategory;
  /** Энэ ангилалд төлөх нийт дүн (сонгосон сар хүртэлх бүх үлдэгдэл) */
  due: number;
  /** Сонгосон сарын төлөгдөөгүй хэсэг */
  current: number;
  /** Өмнөх саруудын төлөгдөөгүй үлдэгдэл */
  previous: number;
  /** Үлдэгдэлтэй өмнөх сарууд, хуучнаас нь — 'YYYY-MM' */
  previousMonths: string[];
  /** Зөвхөн тоолууртай ангилалд, сонгосон сарын нэхэмжлэл байвал */
  readings: NoticeReadings | null;
}

export interface FlatNotice {
  flatNumber: number;
  categories: NoticeCategory[];
}

export interface NoticesPayload {
  month: string;
  buildingName: string;
  phone: string;
  accounts: Partial<Record<BillCategory, string>>;
  notices: FlatNotice[];
}

export interface NoticeInvoiceRow extends InvoiceLine {
  prev_reading: number | null;
  current_reading: number | null;
  hot_prev: number | null;
  hot_current: number | null;
  cold_prev: number | null;
  cold_current: number | null;
  usage_amount: number | null;
}

const money = (v: number) => Math.round(v * 100) / 100;

/**
 * Нэг айлын мэдэгдэл. Үлдэгдэлгүй бол null — тэр айлд цаас хэвлэхгүй.
 *
 * @param invoices  айлын БҮХ нэхэмжлэл. Сонгосон сараас ХОЙШХИЙГ энд хасна —
 *                  9 сарын мэдэгдэлд 10 сарын нэхэмжлэл орох ёсгүй.
 * @param paid      ангилал бүрт төлсөн нийт дүн
 */
export function buildFlatNotice(
  flatNumber: number,
  invoices: NoticeInvoiceRow[],
  paid: Map<BillCategory, number>,
  month: string,
): FlatNotice | null {
  const upTo = invoices.filter((i) => i.month <= month);
  const debts = splitDebtByMonth(upTo, paid);
  const categories: NoticeCategory[] = [];

  // Дараалал нь дэлгэцийнхтэй ижил (CATEGORIES)
  for (const { key, hasMeter } of CATEGORIES) {
    const rows = debts.filter((d) => d.category === key && d.remaining > 0);
    const due = money(rows.reduce((s, d) => s + d.remaining, 0));
    if (!hasDebt(due)) continue;

    const current = money(rows.find((d) => d.month === month)?.remaining ?? 0);
    const inv = hasMeter ? upTo.find((i) => i.category === key && i.month === month) : undefined;

    categories.push({
      category: key,
      due,
      current,
      previous: money(due - current),
      // Хэдэн мөнгөний үлдэгдэлтэй сарыг жагсаалтад нэрлэхгүй — «7 сар»
      // гэж бичигдээд 0₮ болж харагдвал оршин суугч гайхна
      previousMonths: rows.filter((d) => d.month < month && d.remaining >= 1).map((d) => d.month),
      readings: !inv
        ? null
        : key === 'ELECTRICITY'
          ? { meter: [inv.prev_reading, inv.current_reading], hot: null, cold: null, usage: inv.usage_amount }
          : {
              meter: null,
              hot: [inv.hot_prev, inv.hot_current],
              cold: [inv.cold_prev, inv.cold_current],
              usage: inv.usage_amount,
            },
    });
  }

  return categories.length ? { flatNumber, categories } : null;
}
