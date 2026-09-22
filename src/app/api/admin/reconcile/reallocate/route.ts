import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { requireAdmin } from '@/lib/supabase/server';

/**
 * POST /api/admin/reconcile/reallocate — АВТОМАТ хуваарилалтыг дахин ажиллуулах
 *
 * Хэзээ хэрэгтэй вэ:
 *  · Импортын үед хуваарилалт алдаа өгч, гүйлгээ нь орчихсон атлаа
 *    хуваарилагдаагүй үлдсэн (commit нь гүйлгээ → хуваарилалт гэсэн 2 алхамтай,
 *    атомик биш)
 *  · Дутуу байсан тоотыг flats хүснэгтэд хожим нэмсэн
 *
 * Файлыг дахин оруулах нь ТУСЛАХГҮЙ — dedupe_hash давхардсан гэж алгасах тул
 * шинэ гүйлгээ үүсэхгүй, улмаар хуваарилалт ч хийгдэхгүй.
 *
 * ДҮРЭМ: зөвхөн тоот нь ЭРГЭЛЗЭЭГҮЙ танигдсан (parsed_flat_number байгаа)
 * гүйлгээг хөндөнө. Эргэлзээтэйг нь админ гараар шийднэ.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const db = createAdminClient();

  // Хуваарилагдаагүй үлдэгдэлтэй, тоот нь танигдсан гүйлгээнүүд.
  // fetchAllRows — PostgREST 1000 мөр л буцаадаг тул дутуу хуваарилахаас
  // хамгаална. Энд дутвал айлын үлдэгдэл буруу хэвээр үлдэнэ.
  let pending: {
    id: string;
    remaining: number;
    parsed_flat_number: number;
    source_category: string;
  }[];
  try {
    pending = await fetchAllRows((from, to) =>
      db
        .from('v_transactions_remaining')
        .select('id, remaining, parsed_flat_number, source_category')
        .eq('status', 'UNMATCHED')
        .not('parsed_flat_number', 'is', null)
        .range(from, to),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Уншихад алдаа гарлаа' },
      { status: 500 },
    );
  }
  if (!pending.length) {
    return NextResponse.json({ allocated: 0, skipped: 0, totalAmount: 0 });
  }

  const { data: flats } = await db.from('flats').select('id, flat_number').eq('is_active', true);
  const flatIdByNumber = new Map<number, string>((flats ?? []).map((f) => [f.flat_number, f.id]));

  const rows: {
    transaction_id: string;
    flat_id: string;
    category: string;
    amount: number;
    is_auto: boolean;
    created_by: string;
  }[] = [];
  const missingFlats = new Set<number>();

  for (const txn of pending) {
    const remaining = Number(txn.remaining);
    if (!(remaining > 0)) continue;

    const flatId = flatIdByNumber.get(txn.parsed_flat_number as number);
    if (!flatId) {
      // Тоот flats хүснэгтэд байхгүй болсон — гараар шийднэ
      missingFlats.add(txn.parsed_flat_number as number);
      continue;
    }

    rows.push({
      transaction_id: txn.id,
      flat_id: flatId,
      category: txn.source_category,
      amount: remaining,
      is_auto: true,
      created_by: admin.id,
    });
  }

  if (!rows.length) {
    return NextResponse.json({ allocated: 0, skipped: missingFlats.size, totalAmount: 0 });
  }

  // Хэсэгчлэн илгээнэ — trigger мөр бүр дээр ажилладаг тул нэг том insert
  // удаан болох эрсдэлтэй
  let allocated = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { data, error } = await db.from('allocations').insert(chunk).select('id');
    if (error) {
      return NextResponse.json(
        { error: `Хуваарилахад алдаа: ${error.message}`, allocated },
        { status: 500 },
      );
    }
    allocated += data?.length ?? 0;
  }

  return NextResponse.json({
    allocated,
    skipped: missingFlats.size,
    missingFlats: [...missingFlats],
    totalAmount: rows.reduce((sum, r) => sum + r.amount, 0),
  });
}
