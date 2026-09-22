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
