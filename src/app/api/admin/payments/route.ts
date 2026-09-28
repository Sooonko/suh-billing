import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { dedupeHash } from '@/lib/matching/parse-statement';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { CATEGORIES, type BillCategory } from '@/lib/types';

/**
 * POST /api/admin/payments — төлбөрийг ГАРААР бүртгэх
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * Бүх данс банкны хуулгаар ордоггүй. СӨХ-ийн дансны хуулгад оршин
 * суугчийн төлбөрөөс гадна зогсоол, дотоод шилжүүлэг зэрэг өөр орлого
 * их холилддог тул СӨХ түүнийг импортлохгүй, гараар бүртгэхээр шийдсэн.
 * Мөн бэлнээр төлсөн, эсвэл хуулгаас унасан төлбөр үргэлж гардаг.
 *
 * СИСТЕМИЙН ДҮРЭМ ХЭВЭЭР: мөнгө нь `transactions` (баримт) болж бүртгэгдээд
 * `allocations`-оор айлд оногдоно. Үлдэгдэл нь урьдын адил
 * `Σнэхэмжлэл − Σхуваарилалт` гэж бодогдоно. Өөр замаар үлдэгдэл
 * залруулах гарц нэмэхгүй — эс бөгөөс тоо хаанаас гарсныг тайлбарлах
 * боломжгүй болно.
 *
 * ⚠️ ДАВХАРДАХ ЭРСДЭЛ: тухайн үеийн банкны хуулгыг ХОЖИМ оруулбал ижил
 * төлбөр дахин орж ирнэ. `dedupe_hash` нь ӨӨР байх тул систем барихгүй.
 * Тиймээс гараар бүртгэсэн ангиллын хуулгыг оруулахгүй байх ёстой.
 *
 * Санамсаргүй давхар бүртгэхээс хамгаалахын тулд hash-д огноо, дүн,
 * тоот, ангиллыг оруулсан — ижил өдөр, ижил дүн, ижил айлыг хоёр удаа
 * бүртгэх гэвэл татгалзана. Үнэхээр хоёр төлбөр байсан бол тэмдэглэл
 * бичиж ялгана.
 *
 * Body: { flatNumber, category, amount, txnDate, note? }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const body = (await request.json()) as {
    flatNumber?: number | string;
    category?: string;
    amount?: number | string;
    txnDate?: string;
    note?: string | null;
  };

  const flatNumber = Number(body.flatNumber);
  const category = String(body.category ?? '') as BillCategory;
  const amount = Number(body.amount);
  const txnDate = String(body.txnDate ?? '');
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!Number.isInteger(flatNumber) || flatNumber <= 0) {
    return NextResponse.json({ error: 'Тоот буруу байна' }, { status: 400 });
  }
  if (!CATEGORIES.some((c) => c.key === category)) {
    return NextResponse.json({ error: 'Ангилал буруу байна' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Дүн 0-ээс их байх ёстой' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txnDate)) {
    return NextResponse.json({ error: 'Огноо буруу байна' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: flat } = await db
    .from('flats')
    .select('id')
    .eq('flat_number', flatNumber)
    .eq('is_active', true)
    .maybeSingle();
  if (!flat) {
    return NextResponse.json({ error: `${flatNumber} тоот бүртгэлгүй байна` }, { status: 404 });
  }

  // Гүйлгээ нь ямар нэг дансанд харьяалагдах ёстой (bank_account_id not null)
  const { data: account } = await db
    .from('bank_accounts')
    .select('id')
    .eq('category', category)
    .maybeSingle();
  if (!account) {
    return NextResponse.json(
      { error: `${category} ангиллын данс бүртгэгдээгүй байна` },
      { status: 400 },
    );
  }

  const description = `Гараар бүртгэсэн · ${flatNumber} тоот${note ? ` · ${note}` : ''}`;
  const hash = await dedupeHash({
    date: `MANUAL-${txnDate}`,
    amount,
    description,
    closingBalance: null,
  });

  const { data: txn, error: txnError } = await db
    .from('transactions')
    .insert({
      bank_account_id: account.id,
      source_category: category,
      txn_date: txnDate,
      amount,
      description,
      dedupe_hash: hash,
      parsed_flat_number: flatNumber,
      match_confidence: 'HIGH',
      review_reason: 'Админ гараар бүртгэсэн',
      status: 'UNMATCHED',
    })
    .select('id')
    .single();

  if (txnError) {
    // 23505 = unique violation → яг ижил төлбөр аль хэдийн бүртгэгдсэн
    const duplicate = txnError.code === '23505';
    return NextResponse.json(
      {
        error: duplicate
          ? 'Яг ийм төлбөр (ижил өдөр, дүн, тоот) аль хэдийн бүртгэгдсэн байна. Үнэхээр хоёр төлбөр бол тэмдэглэл бичиж ялгана уу.'
          : txnError.message,
      },
      { status: duplicate ? 409 : 400 },
    );
  }

  // Мөнгийг айлд оногдуулна — энэ л үлдэгдлийг хөдөлгөнө
  const { error: allocError } = await db.from('allocations').insert({
    transaction_id: txn.id,
    flat_id: flat.id,
    category,
    amount,
    is_auto: false,
    created_by: admin.id,
  });

  if (allocError) {
    // Хуваарилалт бүтэлгүйтвэл гүйлгээг үлдээх нь утгагүй — цэвэрлэнэ
    await db.from('transactions').delete().eq('id', txn.id);
    return NextResponse.json({ error: `Хуваарилахад алдаа: ${allocError.message}` }, { status: 400 });
  }

  revalidateTag('transactions');
  return NextResponse.json({ ok: true, id: txn.id, flatNumber, amount });
}
