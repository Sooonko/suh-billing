import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** '2026-11' → '2027-06' хооронд хэдэн сар (хоёулаа орно) */
const monthSpan = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5)) - Number(from.slice(5)) + 1;

/**
 * POST /api/admin/heating-seasons — халаалтын улирал нэмэх
 *
 * Body: { startMonth: 'YYYY-MM', endMonth: 'YYYY-MM' }
 *
 * Давхцсан улирал зөвшөөрөхгүй — аль нь хүчинтэй вэ гэдэг тодорхойгүй болно.
 * Аль хэдийн үүссэн нэхэмжлэл ӨӨРЧЛӨГДӨХГҮЙ: дараагийн импорт/засвараас
 * үйлчилнэ.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const { startMonth, endMonth } = (await request.json()) as { startMonth?: string; endMonth?: string };
  if (!startMonth || !endMonth || !MONTH_RE.test(startMonth) || !MONTH_RE.test(endMonth)) {
    return NextResponse.json({ error: 'Эхлэх ба дуусах сар шаардлагатай' }, { status: 400 });
  }
  if (endMonth < startMonth) {
    return NextResponse.json({ error: 'Дуусах сар эхлэх сараас өмнө байна' }, { status: 400 });
  }
  // Халаалтын улирал жилээс урт байх боломжгүй — сар/он андуурсан байх магадлалтай
  if (monthSpan(startMonth, endMonth) > 12) {
    return NextResponse.json({ error: 'Улирал 12 сараас урт байна — он, сараа шалгана уу' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: overlapping } = await db
    .from('heating_seasons')
    .select('start_month, end_month')
    .lte('start_month', endMonth)
    .gte('end_month', startMonth);
  if (overlapping?.length) {
    const o = overlapping[0];
    return NextResponse.json(
      { error: `${o.start_month} — ${o.end_month} улиралтай давхцаж байна` },
      { status: 400 },
    );
  }

  const { error } = await db
    .from('heating_seasons')
    .insert({ start_month: startMonth, end_month: endMonth, created_by: admin.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/heating-seasons?id=… */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from('heating_seasons').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
