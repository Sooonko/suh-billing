import { NextResponse } from 'next/server';
import { buildNameIndex, matchFlat } from '@/lib/matching/parse-flat';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { requireAdmin } from '@/lib/supabase/server';

/**
 * POST /api/admin/reconcile/reparse — тоот танихыг ДАХИН ажиллуулах
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * Гүйлгээ орж ирэхэд тоотыг таньж `parsed_flat_number` баганад хадгалдаг.
 * Задлагчийг сайжруулахад ХУУЧИН мөрүүд хуучин хариугаараа үлдэнэ —
 * файлыг дахин оруулах нь ТУСЛАХГҮЙ (dedupe_hash давхардсан гэж алгасна).
 *
 * Энэ үйлдэл нь тоот танигдаагүй үлдсэн гүйлгээний УТГЫГ дахин уншиж,
 * шинэ задлагчаар таьна. Гүйлгээний дүн, огноо, утга — банкны баримт нь
 * ХЭВЭЭР үлдэнэ, зөвхөн таалтын үр дүн шинэчлэгдэнэ.
 *
 * Хуваарилалт ЭНД хийгдэхгүй. Таьсны дараа «Хуваарилах» товчоор мөнгийг
 * айлд оногдуулна — хоёр алхмыг салгаснаар админ юу болохыг эхлээд
 * хараад дараа нь зөвшөөрнө.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const db = createAdminClient();

  const { data: flats } = await db
    .from('flats')
    .select('id, flat_number, owner_name, excel_label')
    .eq('is_active', true);

  const validFlats = new Set<number>((flats ?? []).map((f) => f.flat_number as number));
  const nameIndex = buildNameIndex(
    (flats ?? []).map((f) => ({
      flatNumber: f.flat_number as number,
      name: f.owner_name as string | null,
      excelLabel: f.excel_label as string | null,
    })),
  );

  // Тоот нь танигдаагүй үлдсэн гүйлгээнүүд
  let pending: { id: string; description: string }[];
  try {
    pending = await fetchAllRows((from, to) =>
      db
        .from('transactions')
        .select('id, description')
        .is('parsed_flat_number', null)
        .range(from, to),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Уншихад алдаа гарлаа' },
      { status: 500 },
    );
  }

  const found: { id: string; flatNumber: number }[] = [];
  for (const txn of pending) {
    const match = matchFlat(txn.description ?? '', validFlats, nameIndex);
    if (match.flatNumber !== null) found.push({ id: txn.id, flatNumber: match.flatNumber });
  }

  // Мөр бүрийг тусад нь шинэчилнэ — зөвхөн ЭНЭ нэг баганыг хөндөнө
  let updated = 0;
  for (const row of found) {
    const { error } = await db
      .from('transactions')
      .update({ parsed_flat_number: row.flatNumber })
      .eq('id', row.id);
    if (!error) updated++;
  }

  return NextResponse.json({
    checked: pending.length,
    updated,
    stillUnknown: pending.length - updated,
  });
}
