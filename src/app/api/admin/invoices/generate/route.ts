import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { calculateFixedFee, FixedFeeError } from '@/lib/billing/fixed-fee';
import type { TariffRow } from '@/lib/billing/water-heat';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { requireAdmin } from '@/lib/supabase/server';
import type { BillCategory } from '@/lib/types';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * POST /api/admin/invoices/generate — тоолуургүй ангиллын нэхэмжлэл үүсгэх
 *
 * СӨХ-ийн хураамж бүх айлд ижил тул Excel импорт хэрэггүй. Сар сонгоод
 * идэвхтэй БҮХ тоотод нэхэмжлэл үүсгэнэ.
 *
 * Дүнг тарифын хүснэгтээс авна — гараар бичихгүй. Ингэснээр хураамж
 * өөрчлөгдөхөд /admin/tariffs дээр нэг л газар засна.
 *
 * Дахин ажиллуулбал ДАРЖ бичнэ (upsert) — андуурч буруу сар сонгосныг
 * засах боломжтой.
 *
 * Body: { category, billingMonth, dryRun? }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const { category, billingMonth, dryRun } = (await request.json()) as {
    category?: string;
    billingMonth?: string;
    dryRun?: boolean;
  };

  if (category !== 'SOH') {
    return NextResponse.json(
      { error: 'Энэ үйлдэл зөвхөн СӨХ ангилалд зориулагдсан' },
      { status: 400 },
    );
  }
  if (!billingMonth || !MONTH_RE.test(billingMonth)) {
    return NextResponse.json({ error: 'Тооцооны сар "2026-09" хэлбэртэй байх ёстой' }, { status: 400 });
  }

  const db = createAdminClient();
  const monthStart = `${billingMonth}-01`;

  const { data: tariffRows } = await db
    .from('tariffs')
    .select('code, label, unit, rate')
    .eq('category', category)
    .lte('effective_from', monthStart)
    .or(`effective_to.is.null,effective_to.gte.${monthStart}`)
    .order('sort_order');

  const tariffs: TariffRow[] = (tariffRows ?? []).map((t) => ({
    code: t.code as string,
    label: t.label as string,
    unit: t.unit as TariffRow['unit'],
    rate: Number(t.rate),
  }));

  let bill;
  try {
    bill = calculateFixedFee(tariffs);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof FixedFeeError
            ? `${error.message}. /admin/tariffs цэсээс СӨХ-ийн хураамж оруулна уу.`
            : 'Бодоход алдаа гарлаа',
      },
      { status: 400 },
    );
  }

  // Бүх идэвхтэй тоот — дутвал зарим айлд СӨХ-ийн нэхэмжлэл үүсэхгүй
  const flats = await fetchAllRows<{ id: string }>((from, to) =>
    db.from('flats').select('id').eq('is_active', true).range(from, to),
  );
  if (!flats.length) {
    return NextResponse.json({ error: 'Идэвхтэй тоот олдсонгүй' }, { status: 400 });
  }

  // Тухайн сард аль хэдийн байгаа нэхэмжлэл — дарж бичихийг урьдчилж хэлнэ
  const { data: existing } = await db
    .from('invoices')
    .select('flat_id')
    .eq('category', category)
    .eq('billing_month', billingMonth);
  const replacing = existing?.length ?? 0;

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      flats: flats.length,
      replacing,
      amount: bill.total,
      totalAmount: Math.round(bill.total * flats.length * 100) / 100,
      lines: bill.lines,
    });
  }

  const { data: inserted, error } = await db
    .from('invoices')
    .upsert(
      flats.map((flat) => ({
        flat_id: flat.id,
        category,
        billing_month: billingMonth,
        bill_amount: bill.total,
        breakdown: bill.lines,
      })),
      { onConflict: 'flat_id,category,billing_month' },
    )
    .select('id');

  if (error) {
    return NextResponse.json({ error: `Үүсгэхэд алдаа: ${error.message}` }, { status: 500 });
  }

  // Шинэ сар шүүлтүүрийн цэсэнд ШУУД гарна — үгүй бол кэш 10 минут хуучрана
  revalidateTag('invoices');
  return NextResponse.json({
    created: inserted?.length ?? 0,
    replaced: replacing,
    amount: bill.total,
    totalAmount: Math.round(bill.total * (inserted?.length ?? 0) * 100) / 100,
  });
}
