/**
 * Админы жагсаалтын хайлтын дүрэм.
 *
 * АСУУДАЛ: хайлт нь тоог ХЭСЭГЧЛЭН тааруулдаг байсан тул «7» гэж хайвал
 * 178, 157, 173 … бүгд гарч ирээд 222 мөр болдог. Байранд 6, 7 тоот
 * ҮНЭХЭЭР байдаг учир тэднийг хайх ямар ч арга байхгүй болсон.
 *
 * ДҮРЭМ: хайлт нь ЦЭВЭР ТОО бол тоотын ЯГ тохирол. Үгүй бол нэр,
 * гүйлгээний утгын хэсэгчилсэн хайлт.
 *
 * Тоогоор хэсэгчлэн хайх хэрэгцээ бараг гардаггүй — админ тодорхой
 * айлыг хайдаг. Харин нэрээр хайхад хэсэгчилсэн тохирол зайлшгүй
 * («баяр» → «БАЯРМАА»).
 */
export function matchesSearch(
  search: string,
  row: {
    /** Тухайн мөрийн тоот. Танигдаагүй бол null. */
    flatNumber?: number | null;
    /** Нэр, гүйлгээний утга зэрэг чөлөөт текстүүд */
    texts?: (string | null | undefined)[];
  },
): boolean {
  const needle = search.trim();
  if (!needle) return true;

  // Цэвэр тоо → ТООТ-ын яг тохирол
  if (/^\d+$/.test(needle)) {
    return row.flatNumber !== null && row.flatNumber !== undefined
      ? row.flatNumber === Number(needle)
      : false;
  }

  const lower = needle.toLowerCase();
  return (row.texts ?? []).some((t) => (t ?? '').toLowerCase().includes(lower));
}
