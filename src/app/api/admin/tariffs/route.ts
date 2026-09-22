import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import type { BillCategory, TariffUnit } from '@/lib/types';

const CATEGORIES: BillCategory[] = ['WATER_HEAT', 'SOH', 'ELECTRICITY'];
const UNITS: TariffUnit[] = ['PER_M3', 'FIXED', 'PERCENT'];

/** '2026-10-01' → '2026-09-30' — шинэ тариф эхлэхийн өмнөх өдөр */
function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * POST /api/admin/tariffs — тариф СОЛИХ (эсвэл шинээр нэмэх)
 *
 * ⚠️ Хуучин мөрийг ЗАСАХГҮЙ. effective_to тавьж хааж, шинэ мөр үүсгэнэ.
 * Ингэснээр өнгөрсөн сарууд хуучин тарифаараа тайлбарлагдсан хэвээр үлдэнэ.
 *
 * Body: { category, code, label, unit, rate, effectiveFrom }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const body = (await request.json()) as {
    category?: string;
    code?: string;
    label?: string;
    unit?: string;
    rate?: number | string;
    entrance?: number | null;
    effectiveFrom?: string;
  };

  const category = body.category as BillCategory;
  const code = body.code?.trim().toUpperCase();
  const label = body.label?.trim();
  const unit = body.unit as TariffUnit;
  const rate = Number(body.rate);
  const effectiveFrom = body.effectiveFrom;
  // NULL = бүх орцод. Тухайн орцын тариф ерөнхийг нь дардаг.
  const entrance =
    body.entrance === null || body.entrance === undefined ? null : Number(body.entrance);

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Ангилал буруу' }, { status: 400 });
  }
  if (!code || !label) {
    return NextResponse.json({ error: 'Код ба нэр шаардлагатай' }, { status: 400 });
  }
  if (!UNITS.includes(unit)) {
    return NextResponse.json({ error: 'Нэгж буруу' }, { status: 400 });
  }
  if (!Number.isFinite(rate) || rate < 0) {
    return NextResponse.json({ error: 'Тариф сөрөг эсвэл тоо биш байна' }, { status: 400 });
  }
  if (!effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    return NextResponse.json({ error: 'Хүчинтэй огноо буруу' }, { status: 400 });
  }

  const db = createAdminClient();

  // Одоо хүчинтэй мөрийг олоод хаана
  const { data: currentRows } = await db
    .from('tariffs')
    .select('id, effective_from, rate, entrance')
    .eq('category', category)
    .eq('code', code)
    .is('effective_to', null);
  const current = (currentRows ?? []).find(
    (r) => (r.entrance === null ? null : Number(r.entrance)) === entrance,
  );

  if (current) {
    if (effectiveFrom <= (current.effective_from as string)) {
      return NextResponse.json(
        {
          error: `Шинэ огноо (${effectiveFrom}) нь одоогийн тарифын эхэлсэн огноо (${current.effective_from}) -оос ХОЙШ байх ёстой.`,
        },
        { status: 400 },
      );
    }
    const { error } = await db
      .from('tariffs')
      .update({ effective_to: dayBefore(effectiveFrom) })
      .eq('id', current.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: inserted, error: insertError } = await db
    .from('tariffs')
    .insert({
      category,
      code,
      label,
      unit,
      rate,
      entrance,
      effective_from: effectiveFrom,
      sort_order: 99,
      created_by: admin.id,
    })
    .select('id')
    .single();

  if (insertError) {
    // Хаалт амжилттай болсон ч оруулалт уначихвал тариф "алга" болно — сэргээнэ
    if (current) await db.from('tariffs').update({ effective_to: null }).eq('id', current.id);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: inserted.id, replaced: Boolean(current) });
}

/** DELETE /api/admin/tariffs?id=<id> — андуурч нэмсэн мөрийг устгах */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from('tariffs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
