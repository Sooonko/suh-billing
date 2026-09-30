import { NextResponse } from 'next/server';
import { buildNameIndex } from '@/lib/matching/parse-flat';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { detectCategoryHint } from '@/lib/matching/detect-category';
import { findExistingHashes } from '@/lib/matching/find-duplicates';
import { overpayOf } from '@/lib/money';
import { parseStatement, type RawRow } from '@/lib/matching/parse-statement';
import type { BillCategory } from '@/lib/types';

/**
 * POST /api/admin/reconcile/preview
 *
 * Банкны хуулгыг УНШИЖ ХАРУУЛНА — датабазад юу ч бичихгүй.
 * Админ үр дүнг хараад зөвшөөрсний дараа /commit дуудна.
 *
 * Мөнгөтэй холбоотой үйлдлийг хоёр алхам болгосон шалтгаан: буруу файл эсвэл
 * буруу данс сонгосон тохиолдолд датабаз цэвэр хэвээр үлдэнэ.
 *
 * Body: { bankAccountId: string, rows: RawRow[] }
 *   rows нь браузер дээр SheetJS-ээр уншсан Excel мөрүүд.
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

  // 1. Данс → категори. Хуулга аль дансных болохыг админ сонгосон тул
  //    гүйлгээний утгаас категори таах ШААРДЛАГАГҮЙ.
  const { data: account, error: accountError } = await db
    .from('bank_accounts')
    .select('id, category, display_name')
    .eq('id', bankAccountId)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Данс олдсонгүй' }, { status: 404 });
  }
  const category = account.category as BillCategory;

  // 2. Бүх жинхэнэ тоот — тоот таних баталгаажуулалтын түлхүүр
  const { data: flats } = await db
    .from('flats')
    .select('id, flat_number, owner_name, excel_label')
    .eq('is_active', true);
  const flatIdByNumber = new Map<number, string>((flats ?? []).map((f) => [f.flat_number, f.id]));
  const validFlats = new Set(flatIdByNumber.keys());
  // «ARMO SPORT LAB», «ХҮСЛЭН ДЭЛГҮҮР» гэх тоотгүй бичиглэлийг таихад
  const nameIndex = buildNameIndex(
    (flats ?? []).map((f) => ({
      flatNumber: f.flat_number as number,
      name: f.owner_name as string | null,
      excelLabel: f.excel_label as string | null,
    })),
  );

  // 3. Мөр бүрийг задлан шинжилнэ (зарлага автоматаар хасагдана)
  const { transactions, skipped, columns } = await parseStatement(rows, validFlats, nameIndex);

  // Орлого нь тусдаа багана, эсвэл нэг "Дүн" багана (сөрөг = зарлага) байж болно
  if ((!columns.credit && !columns.amount) || !columns.description) {
    return NextResponse.json(
      {
        error:
          '"Орлого" (эсвэл "Гүйлгээний дүн") ба "Гүйлгээний утга" багана олдсонгүй. Файлын толгой мөрийг шалгана уу.',
        foundColumns: Object.keys(rows[0] ?? {}),
      },
      { status: 400 },
    );
  }

  // 4. Аль хэдийн оруулсан гүйлгээг илрүүлнэ (нэг файлыг 2 удаа оруулах эрсдэл).
  //    Hash-аас гадна цагийн бүсээс хамаарахгүй шалгуур ажиллана — дэлгэрэнгүйг
  //    find-duplicates.ts дотор.
  const existing = await findExistingHashes(db, transactions);

  // 5. Таарсан айлуудын одоогийн үлдэгдэл — илүү төлөлтийг урьдчилж анхааруулна
  const matchedFlatIds = [...new Set(transactions.filter((t) => t.flatNumber).map((t) => flatIdByNumber.get(t.flatNumber!)!))];
  const balances = new Map<string, number>();
  if (matchedFlatIds.length) {
    const { data } = await db
      .from('v_flat_balances')
      .select('flat_id, balance')
      .eq('category', category)
      .in('flat_id', matchedFlatIds);
    data?.forEach((r) => balances.set(r.flat_id, Number(r.balance)));
  }

  // Нэг айл ЭНЭ хуулгад хэдэн удаа төлсөн бэ — олон удаа төлсөнийг тэмдэглэнэ
  const paymentsPerFlat = new Map<number, number>();
  for (const t of transactions) {
    if (t.flatNumber === null) continue;
    paymentsPerFlat.set(t.flatNumber, (paymentsPerFlat.get(t.flatNumber) ?? 0) + 1);
  }

  const preview = transactions.map((t) => {
    const flatId = t.flatNumber ? flatIdByNumber.get(t.flatNumber) ?? null : null;
    const isDuplicate = existing.has(t.dedupeHash);
    const balance = flatId ? (balances.get(flatId) ?? 0) : null;

    // Төлсөн дүн нь өрөөс их → илүү төлөлт эсвэл өөр ангилалд хамаарах төлбөр.
    // Автоматаар хуваахгүй — админд мэдэгдээд өөрөө шийднэ.
    const excess = balance === null ? null : overpayOf(t.amount, balance);

    /**
     * ⚠️ 50₮-ын хүлцэл ЗААВАЛ хэрэглэнэ (money.ts).
     *
     * Нэхэмжлэл 2 аравтын оронтой бодогддог, банк бүхэл төгрөгөөр хөдөлдөг
     * тул айл ЯГ бүтэн төлсөн ч хагас төгрөгийн үлдэц гардаг. Урьд нь
     * `t.amount > balance` гэж шалгаж байсан тул 0.33₮ зөрүү ч анхааруулга
     * өдөөж, дэлгэц дээр «Илүү төлөлт: 0₮» гэсэн утгагүй мөр гарч байв —
     * 0 гэдэг нь илүү төлөлт БИШ гэсэн үг.
     */
    const overpay = excess !== null && !isDuplicate;

    // ⚠️ Нэг айл ЭНЭ хуулгад олон удаа төлсөн бол дараагийн мөр нь аль хэдийн
    // багассан үлдэгдэлтэй тулгалдах ёстой. Эс бөгөөс хоёр дахь төлбөр нь
    // «илүү төлөлт байхгүй» гэж буруу харагдана.
    if (flatId && balance !== null && !isDuplicate) {
      balances.set(flatId, balance - t.amount);
    }

    return {
      ...t,
      flatId,
      isDuplicate,
      currentBalance: balance,
      overpayAmount: overpay ? excess : null,
      needsAdminDecision: overpay,
      /** Энэ айл энэ хуулгад хэдэн удаа төлсөн бэ (1 бол хэвийн) */
      paymentsForFlat: t.flatNumber ? (paymentsPerFlat.get(t.flatNumber) ?? 1) : 1,
    };
  });

  const willImport = preview.filter((p) => !p.isDuplicate);

  // Хуулгын агуулга сонгосон данстай таарч байна уу — БУРУУ ДАНС сонгосон
  // эсэхийг илрүүлнэ. Тулгалтад нөлөөлөхгүй, зөвхөн анхааруулга.
  const categoryHint = detectCategoryHint(transactions.map((t) => t.description));

  return NextResponse.json({
    account: { id: account.id, category, displayName: account.display_name },
    categoryHint,
    columns,
    summary: {
      totalRows: rows.length,
      skipped: skipped.length,
      duplicates: preview.length - willImport.length,
      autoMatched: willImport.filter((p) => p.flatId).length,
      needsReview: willImport.filter((p) => !p.flatId).length,
      needsDecision: willImport.filter((p) => p.needsAdminDecision).length,
      totalAmount: willImport.reduce((sum, p) => sum + p.amount, 0),
    },
    transactions: preview,
    skipped,
  });
}
