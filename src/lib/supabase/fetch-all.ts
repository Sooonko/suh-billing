/**
 * Бүх мөрийг хуудаслаж татах.
 *
 * ⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * Supabase (PostgREST) нэг хүсэлтэд ХАМГИЙН ИХ 1000 мөр буцаадаг.
 * `.limit(50000)` гэж бичсэн ч 1000 мөр л ирнэ — бөгөөд АЛДАА ЗААХГҮЙ.
 * Тиймээс мөрийн тоо 1000-аас хэтэрмэгц тооцоо чимээгүйхэн буруу болно.
 *
 * Жишээ: нэхэмжлэл сар бүр ~630 мөрөөр өсдөг. 2 сарын дараа 1000-г
 * хэтэрч, FIFO өрийн задаргаа дутуу датагаар бодогдож эхэлнэ. Ямар ч
 * алдаа гарахгүй, зүгээр л тоо буруу гарна — хамгийн хортой төрлийн алдаа.
 *
 * Хэрэглэх нь: мөрийн тоо хязгааргүй өсдөг хүснэгтээс БҮХ мөр авах
 * шаардлагатай үед (нэхэмжлэл, хуваарилалт, гүйлгээ). Дэлгэцэнд
 * харуулах жагсаалтад хэрэггүй — тэнд `.limit()` нь зориудын хязгаар.
 *
 * @example
 * const rows = await fetchAllRows((from, to) =>
 *   db.from('invoices').select('flat_id, bill_amount').range(from, to),
 * );
 */
const PAGE_SIZE = 1000;

/** Хязгааргүй давталтаас хамгаална — 500 мянган мөрөөс хэтэрвэл логик эндүүрсэн */
const MAX_ROWS = 500_000;

export async function fetchAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const batch = data ?? [];
    rows.push(...batch);

    // Дүүрэн хуудас ирээгүй бол цаана мөр байхгүй
    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}
