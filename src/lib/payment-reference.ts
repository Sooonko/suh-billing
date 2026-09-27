import type { BillCategory } from '@/lib/types';

/**
 * Оршин суугчид ХУУЛЖ тавихад зориулсан гүйлгээний утга.
 *
 * ЯАГААД ЭНЭ ЧУХАЛ ВЭ:
 * Бүх автомат тулгалт гүйлгээний утганаас эхэлдэг. Одоо хүмүүс дураараа
 * бичдэг тул «2R ORTS TSAHILGAANII TULBUR» гэх мэт таних аргагүй утга
 * гарч, админ гараар шийдэх ажил үүсдэг.
 *
 * Бэлэн утга өгвөл гурван зүйл нэг дор шийдэгдэнэ:
 *   1. ТООТ      — хэний төлбөр болох нь эргэлзээгүй
 *   2. САР       — аль сарын төлбөр болохыг таамаглах шаардлагагүй
 *   3. АНГИЛАЛ   — буруу данс руу орсныг шууд барина
 *
 * ⚠️ ЭНД ҮҮСГЭСЭН УТГА нь `matchFlat` болон `detectCategoryHint`-ээр
 * ЗААВАЛ зөв уншигдах ёстой. Хоёр тал зөрвөл оршин суугч зааврын дагуу
 * бичсэн ч төлбөр нь гар шалгалт руу унана. `payment-reference.test.ts`
 * энэ гэрээг хамгаална — формат өөрчлөхөөс өмнө тэр тестийг ажиллуулна.
 */

/** Ангилал бүрийн товч нэр — задлагчийн түлхүүр үгтэй тааруулсан */
const CATEGORY_WORD: Record<BillCategory, string> = {
  WATER_HEAT: 'ус дулаан',
  ELECTRICITY: 'цахилгаан',
  SOH: 'СӨХ',
};

/**
 * @param flatNumber  айлын тоот
 * @param category    төлбөрийн ангилал
 * @param month       'YYYY-MM'. Байхгүй бол сар бичихгүй.
 *
 * @example buildPaymentReference(197, 'WATER_HEAT', '2026-09')
 *          → "197 тоот 9 сар ус дулаан"
 */
export function buildPaymentReference(
  flatNumber: number,
  category: BillCategory,
  month?: string | null,
): string {
  const parts = [`${flatNumber} тоот`];

  // "2026-09" → "9 сар". Банкны утга богино байх тусам сайн тул он бичихгүй —
  // төлбөр хэдэн жилийн дараа ирдэггүй.
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    parts.push(`${Number(month.slice(5, 7))} сар`);
  }

  parts.push(CATEGORY_WORD[category]);
  return parts.join(' ');
}
