import type { BillCategory } from '@/lib/types';

/**
 * Өрийг сараар задлах — FIFO дүрэм.
 *
 * ЯАГААД ДҮРЭМ ХЭРЭГТЭЙ ВЭ:
 * `allocations` хүснэгтэд `billing_month` БАЙХГҮЙ. Банкнаас орж ирсэн мөнгө
 * зөвхөн «аль айл, аль ангилал» гэдэгт наалддаг, «аль сарын нэхэмжлэл»
 * гэдэгт наалддаггүй. Оршин суугч 9 сарын төлбөрөө 10 сард төлж, эсвэл
 * гурван сарыг нэг дор төлж болно — банкны гүйлгээнээс үүнийг мэдэх аргагүй.
 *
 * Тиймээс «тухайн сар төлөгдсөн үү» гэдгийг ДҮРМЭЭР шийднэ: төлсөн нийт
 * мөнгийг хамгийн ХУУЧИН сараас эхлэн зарцуулна. Үлдсэн нь өр.
 *
 * Энэ функц нь оршин суугчийн «Өр үүссэн сарууд» болон админы «Айлууд»
 * дэлгэц ХОЁУЛАА хэрэглэдэг цорын ганц эх сурвалж. Хоёр дэлгэц ижил
 * логикоор боддог тул зөрөх боломжгүй.
 */

export interface InvoiceLine {
  /** 'YYYY-MM' */
  month: string;
  category: BillCategory;
  billed: number;
}

export interface MonthlyDebt {
  month: string;
  category: BillCategory;
  billed: number;
  /** Тэр сарын нэхэмжлэлээс FIFO-гоор хаагдсан дүн */
  paid: number;
  /** Тэр сард үлдсэн өр. Хэзээ ч сөрөг болохгүй. */
  remaining: number;
}

/** Мөнгө 2 аравтын оронтой — float-ын үлдэгдэл 0.0000001 өр болж харагдахгүй */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * @param invoices  айлын БҮХ нэхэмжлэл (бүх сар, бүх ангилал)
 * @param paidByCategory  ангилал тус бүрт төлсөн НИЙТ дүн
 * @returns сар × ангилал бүрийн мөр — бүрэн төлөгдсөнийг Ч хамт буцаана,
 *          шүүлтийг дуудагч тал өөрөө хийнэ
 */
export function splitDebtByMonth(
  invoices: InvoiceLine[],
  paidByCategory: Map<BillCategory, number>,
): MonthlyDebt[] {
  const byCategory = new Map<BillCategory, InvoiceLine[]>();
  for (const line of invoices) {
    const list = byCategory.get(line.category) ?? [];
    list.push(line);
    byCategory.set(line.category, list);
  }

  const result: MonthlyDebt[] = [];

  for (const [category, lines] of byCategory) {
    // Төлсөн мөнгөний «сан» — хуучин сараас эхлэн зарцуулна
    let pool = paidByCategory.get(category) ?? 0;

    for (const line of [...lines].sort((a, b) => a.month.localeCompare(b.month))) {
      const paid = Math.min(pool, line.billed);
      pool -= paid;
      result.push({
        month: line.month,
        category,
        billed: money(line.billed),
        paid: money(paid),
        remaining: money(line.billed - paid),
      });
    }

    // Санд мөнгө үлдвэл тэр нь ИЛҮҮ ТӨЛӨЛТ. Сарын задаргаанд харуулах
    // газар байхгүй (аль сарынх нь болохыг мэдэхгүй) тул үл хэрэгсэнэ —
    // нийт үлдэгдэл дээр сөрөг тоо болж аль хэдийн харагддаг.
  }

  result.sort((a, b) => a.month.localeCompare(b.month) || a.category.localeCompare(b.category));
  return result;
}

/** Задаргаанаас нэг сарыг сонгож, ангиллаар индексжүүлнэ */
export function debtForMonth(
  rows: MonthlyDebt[],
  month: string,
): Map<BillCategory, MonthlyDebt> {
  const out = new Map<BillCategory, MonthlyDebt>();
  for (const row of rows) {
    if (row.month === month) out.set(row.category, row);
  }
  return out;
}

/** Нэг төлбөр — FIFO хуваарилалтад оруулах оролт */
export interface PaymentLine {
  id: string;
  category: BillCategory;
  /** ISO огноо — эрэмбэлэхэд хэрэглэнэ */
  date: string;
  amount: number;
}

/** Нэг төлбөр аль сарыг хэдээр хассан бэ */
export interface Coverage {
  month: string;
  /** Энэ төлбөрөөс тэр сард оногдсон дүн */
  amount: number;
  /**
   * Тэр сарын БҮТЭН нэхэмжлэл.
   *
   * Оршин суугч «хэдийн эсрэг хэдийг төлсөн бэ» гэдгийг харах ёстой.
   * Хассан сарын нэхэмжлэлийг харуулж байгаа учир харьцуулалт утгатай —
   * өмнө нь төлбөр ХИЙСЭН сарын нэхэмжлэлийг харуулдаг тул төөрөгдүүлж
   * байв.
   */
  billed: number;
}

/**
 * Төлбөр бүр АЛЬ САРЫН нэхэмжлэлийг хассаныг FIFO дүрмээр тогтооно.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * «Төлсөн түүх» хүснэгт нь төлбөр хийсэн САРЫН нэхэмжлэлийг хажууд
 * харуулдаг байв. Гэтэл 116 тоот 9 сарын 4-нд 8 САРЫНХАА төлбөрийг
 * төлсөн — хүснэгт нь 9 сарын нэхэмжлэл 82,638₮-ийн хажууд «төлсөн
 * 35,614₮» гэж бичсэн тул «9 сараа дутуу төлсөн» мэт харагдсан.
 *
 * Мөнгө тодорхой сарын нэхэмжлэлд наалддаггүй тул дүрмээр л тогтооно:
 * хуучин төлбөр хуучин өрийг эхэлж хаана. Задаргааны хүснэгттэй
 * (`splitDebtByMonth`) ИЖИЛ дүрэм — хоёр тал зөрөх боломжгүй.
 *
 * @returns төлбөрийн id → хассан сарууд. Илүү төлөлт нь ямар ч сард
 *          наалдахгүй тул жагсаалтаас гарна (хоосон массив).
 */
export function allocatePaymentsToMonths(
  invoices: InvoiceLine[],
  payments: readonly PaymentLine[],
): Map<string, Coverage[]> {
  const result = new Map<string, Coverage[]>();

  // Ангилал бүр ТУСДАА — усны төлбөр цахилгааны өрийг хаахгүй
  const categories = new Set<BillCategory>([
    ...invoices.map((i) => i.category),
    ...payments.map((p) => p.category),
  ]);

  for (const category of categories) {
    /** Сар бүрийн хаагдаагүй үлдэгдэл, хуучнаас нь эрэмбэлсэн */
    const open = invoices
      .filter((i) => i.category === category)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((i) => ({ month: i.month, left: i.billed, billed: i.billed }));

    const mine = payments
      .filter((p) => p.category === category)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const payment of mine) {
      let pool = payment.amount;
      const covers: Coverage[] = [];

      for (const slot of open) {
        // ⚠️ `pool > 0` гэж шалгавал аравтын үлдэц (0.03₮) дараагийн
        // сарыг «хассан» гэж бүртгэж, дэлгэц дээр «9 сар 0₮» гэсэн хог
        // мөр гаргадаг. 1₮-өөс бага хэсгийг үл хэрэгсэнэ.
        if (pool < 1) break;
        if (slot.left < 1) continue;
        const take = Math.min(pool, slot.left);
        slot.left = money(slot.left - take);
        pool = money(pool - take);
        covers.push({ month: slot.month, amount: money(take), billed: money(slot.billed) });
      }

      result.set(payment.id, covers);
    }
  }

  return result;
}
