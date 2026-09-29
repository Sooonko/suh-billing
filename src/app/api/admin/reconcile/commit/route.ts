import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { buildNameIndex } from '@/lib/matching/parse-flat';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { findExistingHashes } from '@/lib/matching/find-duplicates';
import { parseStatement, type RawRow } from '@/lib/matching/parse-statement';
import type { BillCategory } from '@/lib/types';

/**
 * POST /api/admin/reconcile/commit
 *
 * Хуулгыг датабазад БҮРТГЭНЭ.
 *
 * Аюулгүй байдлын дүрэм: клиентээс ирсэн задлан шинжилгээний үр дүнд НАЙДАХГҮЙ.
 * Түүхий мөрүүдийг сервер дээр дахин задлан шинжилнэ. Ингэснээр браузераас
 * "энэ 500,000₮ 105 тоотынх" гэж хуурах боломжгүй.
 *
 * Body: { bankAccountId: string, rows: RawRow[] }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const { bankAccountId, rows } = (await request.json()) as {
    bankAccountId?: string;
    rows?: RawRow[];
  };
  if (!bankAccountId || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'bankAccountId болон rows шаардлагатай' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: account } = await db
    .from('bank_accounts')
    .select('id, category')
    .eq('id', bankAccountId)
    .single();
  if (!account) return NextResponse.json({ error: 'Данс олдсонгүй' }, { status: 404 });

  const category = account.category as BillCategory;

  const { data: flats } = await db
    .from('flats')
    .select('id, flat_number, owner_name, excel_label')
    .eq('is_active', true);
  const flatIdByNumber = new Map<number, string>((flats ?? []).map((f) => [f.flat_number, f.id]));
  // Харалт ба бичилт ИЖИЛ логикоор танина — эс бөгөөс хараад зөвшөөрсөн
  // зүйлээс өөр юм бичигдэнэ
  const nameIndex = buildNameIndex(
    (flats ?? []).map((f) => ({
      flatNumber: f.flat_number as number,
      name: f.owner_name as string | null,
      excelLabel: f.excel_label as string | null,
    })),
  );

  const { transactions: parsed } = await parseStatement(rows, new Set(flatIdByNumber.keys()), nameIndex);
  if (!parsed.length) {
    return NextResponse.json({ error: 'Бүртгэх орлогын гүйлгээ олдсонгүй' }, { status: 400 });
  }

  /**
   * Аль хэдийн орсон гүйлгээг ЭНД шүүнэ.
   *
   * ЯАГААД upsert-ийн ignoreDuplicates хангалтгүй вэ: тэр нь зөвхөн
   * dedupe_hash дээрх UNIQUE индексээр ажилладаг. Нэг хуулгыг өөр цагийн
   * бүстэй орчноос оруулбал hash өөр гарч, индекс мэдэхгүй өнгөрөөж,
   * ижил төлбөр ХОЁР УДАА бүртгэгдэнэ. find-duplicates нь огнооноос
   * хамаарахгүй шалгуураар тэрийг барина.
   */
  const alreadyImported = await findExistingHashes(db, parsed);
  const transactions = parsed.filter((t) => !alreadyImported.has(t.dedupeHash));
  const skippedAsDuplicate = parsed.length - transactions.length;

  if (!transactions.length) {
    return NextResponse.json({
      batchId: null,
      imported: 0,
      duplicatesSkipped: skippedAsDuplicate,
      autoMatched: 0,
      needsReview: 0,
      message: `Бүх ${skippedAsDuplicate} гүйлгээ аль хэдийн бүртгэгдсэн байна — шинээр орох зүйл алга.`,
    });
  }

  const batchId = crypto.randomUUID();

  // ── 1. Гүйлгээ бүртгэх ─────────────────────────────────────────────────────
  // dedupe_hash дээрх UNIQUE индекс давхардлаас хамгаална.
  // ignoreDuplicates: аль хэдийн байгаа мөрийг чимээгүй алгасна → нэг файлыг
  // хэдэн ч удаа оруулсан үлдэгдэл эвдрэхгүй.
  const { data: inserted, error: insertError } = await db
    .from('transactions')
    .upsert(
      transactions.map((t) => ({
        bank_account_id: account.id,
        source_category: category,
        txn_date: t.txnDate,
        amount: t.amount,
        description: t.description,
        counterparty_account: t.counterpartyAccount,
        closing_balance: t.closingBalance,
        dedupe_hash: t.dedupeHash,
        parsed_flat_number: t.flatNumber,
        match_confidence: t.confidence,
        review_reason: t.reason ?? null,
        import_batch_id: batchId,
        status: 'UNMATCHED' as const,
      })),
      { onConflict: 'dedupe_hash', ignoreDuplicates: true },
    )
    .select('id, dedupe_hash, amount');

  if (insertError) {
    return NextResponse.json({ error: `Бүртгэхэд алдаа: ${insertError.message}` }, { status: 500 });
  }

  const newTransactions = inserted ?? [];
  const txnIdByHash = new Map(newTransactions.map((t) => [t.dedupe_hash, t.id]));

  // ── 2. Автомат хуваарилалт ─────────────────────────────────────────────────
  // Зөвхөн ШИНЭ, тоот нь эргэлзээгүй олдсон гүйлгээг хуваарилна.
  // Бүтэн дүнг данснаас нь урган гарсан ангилал руу оруулна.
  // Илүү төлөлт үүсвэл үлдэгдэл сөрөг болж, дараа сарын нэхэмжлэлээс аяндаа
  // хасагдана. Өөр ангилал руу шилжүүлэх шаардлагатай бол админ дараа нь
  // энэ хуваарилалтыг устгаад гараар хуваана.
  const allocations = transactions
    .filter((t) => t.flatNumber !== null && txnIdByHash.has(t.dedupeHash))
    .map((t) => ({
      transaction_id: txnIdByHash.get(t.dedupeHash)!,
      flat_id: flatIdByNumber.get(t.flatNumber!)!,
      category,
      amount: t.amount,
      is_auto: true,
      created_by: admin.id,
    }));

  if (allocations.length) {
    const { error: allocError } = await db.from('allocations').insert(allocations);
    if (allocError) {
      return NextResponse.json(
        { error: `Хуваарилахад алдаа: ${allocError.message}`, batchId },
        { status: 500 },
      );
    }
  }

  // Шинэ сар шүүлтүүрийн цэсэнд ШУУД гарна — кэш 10 минут хуучрахгүй
  revalidateTag('transactions');
  return NextResponse.json({
    batchId,
    imported: newTransactions.length,
    // Урьдчилж шүүсэн + UNIQUE индекс барьсан — хоёуланг нэг тоонд нэгтгэнэ
    duplicatesSkipped: skippedAsDuplicate + (transactions.length - newTransactions.length),
    autoMatched: allocations.length,
    needsReview: newTransactions.length - allocations.length,
  });
}
