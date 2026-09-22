import type { BillCategory } from '@/lib/types';

/**
 * Гүйлгээний утгаас ямар ангиллын төлбөр болохыг ТААМАГЛАХ.
 *
 * ⚠️ Энэ нь тулгалтад ХЭРЭГЛЭГДЭХГҮЙ — ангилал нь данснаас урган гардаг.
 * Зорилго нь ганц: админ БУРУУ ДАНС сонгосон эсэхийг илрүүлж анхааруулах.
 *
 * Яагаад хэрэгтэй вэ: усны хуулгыг цахилгааны данс руу оруулбал төлбөр
 * буруу ангилалд бүртгэгдэж, айлууд усандаа өртэй хэвээр, цахилгаандаа
 * илүү төлөлттэй харагдана. Тоо нь «ажиллаж» байгаа тул алдаа удаан
 * анзаарагдахгүй өнгөрөх эрсдэлтэй.
 */

/** Латин/кирилл хосыг хоёуланг нь барих загварууд */
const PATTERNS: { category: BillCategory; re: RegExp }[] = [
  { category: 'WATER_HEAT', re: /\bУС\b|УСНЫ|ДУЛАAН|ДУЛААН|\bUS\b|USNII|USNY|DULAAN|\bUSAN/i },
  { category: 'ELECTRICITY', re: /ЦАХИЛГААН|ЦАХ\b|TSAHILGAAN|TSAKHILGAAN|TOGNII|\bТОГ\b|\bTOG\b/i },
  { category: 'SOH', re: /СӨХ|\bSOH\b|SUH\b|ЦЭВЭРЛЭГЭЭ|ХОГ\b/i },
];

export interface CategoryHint {
  /** Ангилал бүрт хэдэн гүйлгээний утга тохирсон бэ */
  counts: Record<BillCategory, number>;
  /** Хамгийн олон тохирсон ангилал. Тодорхойгүй бол null. */
  dominant: BillCategory | null;
  /** Ямар нэг түлхүүр үг олдсон гүйлгээний тоо */
  matched: number;
  total: number;
}

export function detectCategoryHint(descriptions: readonly string[]): CategoryHint {
  const counts: Record<BillCategory, number> = { WATER_HEAT: 0, SOH: 0, ELECTRICITY: 0 };
  let matched = 0;

  for (const description of descriptions) {
    let hit = false;
    for (const { category, re } of PATTERNS) {
      if (re.test(description)) {
        counts[category]++;
        hit = true;
      }
    }
    if (hit) matched++;
  }

  const ranked = (Object.entries(counts) as [BillCategory, number][]).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;

  // Тодорхой ялгаа байхгүй бол таамаглахгүй — худал анхааруулга өгөхгүй.
  // Дор хаяж 5 тохирол, мөн хоёр дахиасаа 2 дахин их байх ёстой.
  const dominant = top[1] >= 5 && top[1] >= (second?.[1] ?? 0) * 2 ? top[0] : null;

  return { counts, dominant, matched, total: descriptions.length };
}
