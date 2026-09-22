import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import type { BillCategory } from '@/lib/types';

/**
 * POST /api/admin/allocations — ГАР АРГААР хуваарилах
 *
 * Хоёр тохиолдолд ашиглана:
 *  1. Тоот таагдаагүй гүйлгээг админ өөрөө айлд оноох
 *  2. Нэг гүйлгээг хэд хэдэн ангилалд ХУВААХ
 *     жишээ: ус дулааны данс руу 80,000₮ орсон ч 50,000 нь ус, 30,000 нь цахилгаан
 *
 * Body: { transactionId, items: [{ flatNumber, category, amount }] }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const { transactionId, items } = (await request.json()) as {
    transactionId?: string;
    items?: { flatNumber: number; category: BillCategory; amount: number }[];
  };

  if (!transactionId || !items?.length) {
    return NextResponse.json({ error: 'transactionId болон items шаардлагатай' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: txn } = await db
    .from('v_transactions_remaining')
    .select('id, amount, remaining')
    .eq('id', transactionId)
    .single();
  if (!txn) return NextResponse.json({ error: 'Гүйлгээ олдсонгүй' }, { status: 404 });

  const total = items.reduce((sum, i) => sum + Number(i.amount), 0);
  if (total > Number(txn.remaining) + 0.005) {
    return NextResponse.json(
      { error: `Хуваарилах дүн (${total}₮) үлдсэн дүнгээс (${txn.remaining}₮) их байна` },
      { status: 400 },
    );
  }

  const { data: flats } = await db
    .from('flats')
    .select('id, flat_number')
    .in('flat_number', items.map((i) => i.flatNumber));
  const flatIdByNumber = new Map<number, string>((flats ?? []).map((f) => [f.flat_number, f.id]));

  const missing = items.filter((i) => !flatIdByNumber.has(i.flatNumber));
  if (missing.length) {
    return NextResponse.json(
      { error: `Тоот олдсонгүй: ${missing.map((m) => m.flatNumber).join(', ')}` },
      { status: 400 },
    );
  }

  const { error } = await db.from('allocations').insert(
    items.map((i) => ({
      transaction_id: transactionId,
      flat_id: flatIdByNumber.get(i.flatNumber)!,
      category: i.category,
      amount: i.amount,
      is_auto: false,
      created_by: admin.id,
    })),
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, allocated: total });
}

/**
 * DELETE /api/admin/allocations?id=<allocationId> — БУЦААХ
 *
 * Буруу оноосныг засах арга. Гүйлгээний түүхий мөр хэвээр үлдэж, зөвхөн
 * хуваарилалт устна. Үлдэгдэл нь Σ(нэхэмжлэл) − Σ(хуваарилалт) томьёогоор
 * бодогддог тул АЯНДАА залруулагдана — гараар тооцоолох зүйл байхгүй.
 */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from('allocations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
