import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';

/**
 * POST /api/admin/reconcile/ignore — гүйлгээг «Тооцохгүй» болгох / буцаах
 *
 * ЯАГААД УСТГАДАГГҮЙ ВЭ:
 * СӨХ-ийн данс руу оршин суугчийн төлбөрөөс ГАДНА өөр орлого ордог —
 * зогсоол, граашны түрээс, цэвэрлэгээ, дотоод шилжүүлэг («СӨХ-Д»
 * 600,000₮). Энэ мөнгө банкинд ҮНЭХЭЭР орсон тул баримтыг устгавал
 * хуулгын үлдэгдэл систем дэх дүнтэй таарахаа болино.
 *
 * Тиймээс гүйлгээг ҮЛДЭЭГЭЭД зөвхөн «айлын өрд тооцохгүй» гэж
 * тэмдэглэнэ. Мөнгө хаанаас ирсэн нь хадгалагдана, харин ямар ч айлын
 * үлдэгдэлд НӨЛӨӨЛӨХГҮЙ.
 *
 * ⚠️ Хуваарилалттай гүйлгээг тооцохгүй болгохоос ӨМНӨ хуваарилалтыг нь
 * устгана — эс бөгөөс мөнгө нь айлд оногдсон хэвээр үлдэж, төлөв нь
 * худал болно.
 *
 * Буцаахад төлвийг хуваарилалтаас нь ДАХИН бодно (sync_transaction_status
 * trigger нь зөвхөн allocations өөрчлөгдөхөд ажилладаг тул гараар).
 *
 * Body: { id, ignored, reason? }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const { id, ignored, reason } = (await request.json()) as {
    id?: string;
    ignored?: boolean;
    reason?: string | null;
  };
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const db = createAdminClient();

  const { data: txn, error: readError } = await db
    .from('transactions')
    .select('id, amount, status')
    .eq('id', id)
    .maybeSingle();
  if (readError || !txn) {
    return NextResponse.json({ error: 'Гүйлгээ олдсонгүй' }, { status: 404 });
  }

  if (ignored === false) {
    // ── Буцаах: төлвийг хуваарилалтаас нь дахин бодно ─────────────────────
    const { data: allocations } = await db
      .from('allocations')
      .select('amount')
      .eq('transaction_id', id);

    const allocated = (allocations ?? []).reduce((sum, a) => sum + Number(a.amount), 0);
    const amount = Number(txn.amount);
    const status =
      allocated === 0 ? 'UNMATCHED' : allocated >= amount - 0.005 ? 'MATCHED' : 'PARTIAL';

    const { error } = await db
      .from('transactions')
      .update({ status, review_reason: null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, status });
  }

  // ── Тооцохгүй болгох ───────────────────────────────────────────────────
  // Оногдсон мөнгийг эхлээд салгана — эс бөгөөс айлын үлдэгдэлд үлдэнэ
  const { error: clearError } = await db.from('allocations').delete().eq('transaction_id', id);
  if (clearError) {
    return NextResponse.json({ error: `Хуваарилалт салгахад алдаа: ${clearError.message}` }, { status: 400 });
  }

  const { error } = await db
    .from('transactions')
    .update({
      status: 'IGNORED',
      review_reason: reason?.trim() || 'Оршин суугчийн төлбөр биш',
    })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, status: 'IGNORED' });
}
