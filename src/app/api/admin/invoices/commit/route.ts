import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { analyzeInvoiceImport, isImportError } from '@/lib/invoice-import';

/**
 * POST /api/admin/invoices/commit
 *
 * Нэхэмжлэлийг датабазад бүртгэнэ.
 *
 * Аюулгүй байдлын дүрэм: клиентээс ирсэн задлан шинжилгээнд НАЙДАХГҮЙ —
 * түүхий мөрийг сервер дээр дахин задална (хуулгын commit-той ижил зарчим).
 *
 * Нэг сарыг ДАХИН оруулбал хуучин мөрийг ДАРЖ бичнэ (upsert). Ингэснээр
 * "буруу файл оруулчихлаа" гэдэг нь засах боломжтой алдаа болно —
 * unique (flat_id, category, billing_month) индекс давхардуулахгүй.
 *
 * Body: { category, billingMonth, rows }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const result = await analyzeInvoiceImport(await request.json());
  if (isImportError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (!result.valid.length) {
    return NextResponse.json({ error: 'Бүртгэх мөр олдсонгүй' }, { status: 400 });
  }

  // Нэг тоот хоёр табад байвал БҮРТГЭХГҮЙ — upsert хийвэл сүүлийнх нь
  // өмнөхийг дуугүй дарж, аль нь орсныг хэн ч мэдэхгүй болно.
  if (result.duplicateFlats.length) {
    return NextResponse.json(
      {
        error:
          `Нэг тоот хоёр табад давхардаж байна: ` +
          result.duplicateFlats
            .map((d) => `${d.flatNumber} (${d.sheets.join(', ')})`)
            .join('; ') +
          `. Excel файлаа шалгаад дахин оруулна уу.`,
      },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('invoices')
    .upsert(
      result.valid.map((r) => ({
        flat_id: r.flatId,
        category: result.category,
        billing_month: result.billingMonth,
        prev_reading: r.prevReading,
        current_reading: r.currentReading,
        usage_amount: r.usageAmount,
        bill_amount: r.billAmount,
        note: r.note,
        // Ус дулаанд л утгатай — бусад ангилалд undefined тул PostgREST алгасна
        hot_prev: r.hotPrev ?? null,
        hot_current: r.hotCurrent ?? null,
        cold_prev: r.coldPrev ?? null,
        cold_current: r.coldCurrent ?? null,
        breakdown: r.breakdown ?? null,
      })),
      { onConflict: 'flat_id,category,billing_month' },
    )
    .select('id');

  if (error) {
    return NextResponse.json({ error: `Бүртгэхэд алдаа: ${error.message}` }, { status: 500 });
  }

  /**
   * Табын нэрнээс таасан орцыг flats хүснэгтэд тэмдэглэнэ.
   *
   * Орц нь тарифт нөлөөлдөг (1 орц ус халаалт аваагүй г.м). Гараар засварлах
   * үед Excel байхгүй тул энд хадгалж авсан утгыг хэрэглэнэ.
   */
  const entranceUpdates = new Map<number, string[]>();
  for (const row of result.valid) {
    if (row.entrance === null) continue;
    const list = entranceUpdates.get(row.entrance) ?? [];
    list.push(row.flatId);
    entranceUpdates.set(row.entrance, list);
  }
  for (const [entrance, flatIds] of entranceUpdates) {
    await db.from('flats').update({ entrance }).in('id', flatIds);
  }

  // Шинэ сар шүүлтүүрийн цэсэнд ШУУД гарна — үгүй бол кэш 10 минут хуучрана
  revalidateTag('invoices');
  return NextResponse.json({
    imported: data?.length ?? 0,
    replaced: result.valid.filter((r) => r.isReplacing).length,
    unknownFlats: result.unknownFlats.length,
    skipped: result.skipped.length,
    totalAmount: result.totalAmount,
  });
}
