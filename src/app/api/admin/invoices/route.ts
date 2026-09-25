import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { calculateElectricity, ElectricityError } from '@/lib/billing/electricity';
import { resolveTariffs, type TariffWithEntrance } from '@/lib/billing/resolve-tariffs';
import { calculateWaterHeat, WaterHeatError, type TariffRow } from '@/lib/billing/water-heat';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Тухайн САРД, тухайн ОРЦОД хүчинтэй байсан тарифыг авна.
 *
 * Модулийн түвшинд гаргасан шалтгаан: засах (PATCH) ба гараар нэмэх (POST)
 * хоёр ИЖИЛ тариф сонгох ёстой. Хоёр хуулбар байвал нэг нь өөрчлөгдөхөд
 * нөгөө нь хоцорч, ижил заалт хоёр өөр дүн өгнө.
 */
async function loadTariffsFor(
  db: ReturnType<typeof createAdminClient>,
  category: string,
  billingMonth: string,
  entrance: number | null,
): Promise<TariffRow[]> {
  const monthStart = `${billingMonth}-01`;
  const { data } = await db
    .from('tariffs')
    .select('code, label, unit, rate, entrance, sort_order')
    .eq('category', category)
    .lte('effective_from', monthStart)
    .or(`effective_to.is.null,effective_to.gte.${monthStart}`)
    .order('sort_order');

  const all: TariffWithEntrance[] = (data ?? []).map((t) => ({
    code: t.code as string,
    label: t.label as string,
    unit: t.unit as TariffRow['unit'],
    rate: Number(t.rate),
    entrance: t.entrance === null ? null : Number(t.entrance),
    sortOrder: Number(t.sort_order),
  }));
  return resolveTariffs(all, entrance);
}

/**
 * POST /api/admin/invoices — нэхэмжлэлийг ГАРААР нэмэх
 *
 * ЯАГААД ХЭРЭГТЭЙ: Excel-д мөр нь байхгүй эсвэл заалт дутуу тул орж
 * ирээгүй айл бүтэн сараар нэхэмжлэлгүй үлддэг (2026-08-ын 109 тоот,
 * 901 цахилгаан, 903 ус дулаан). Тэр айлыг дахин импорт хийлгүйгээр
 * нэмэх гарц байх ёстой.
 *
 * Дүнг систем бодно — админ заалтыг л өгнө. Ингэснээр гараар нэмсэн
 * нэхэмжлэл импортоор орсонтой ЯГ ижил дүрмээр бодогдоно.
 *
 * Body: { category, billingMonth, flatNumber, note?,
 *         hotPrev?, hotCurrent?, coldPrev?, coldCurrent?,   // ус дулаан
 *         prevReading?, currentReading?,                    // цахилгаан
 *         billAmount? }                                     // СӨХ
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const category = String(body.category ?? '');
  const billingMonth = String(body.billingMonth ?? '');
  const flatNumber = Number(body.flatNumber);

  if (!['WATER_HEAT', 'SOH', 'ELECTRICITY'].includes(category)) {
    return NextResponse.json({ error: 'Ангилал буруу байна' }, { status: 400 });
  }
  if (!MONTH_RE.test(billingMonth)) {
    return NextResponse.json({ error: 'Сар "2026-09" хэлбэртэй байх ёстой' }, { status: 400 });
  }
  if (!Number.isInteger(flatNumber) || flatNumber <= 0) {
    return NextResponse.json({ error: 'Тоот буруу байна' }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: flat } = await db
    .from('flats')
    .select('id, flat_number, entrance')
    .eq('flat_number', flatNumber)
    .eq('is_active', true)
    .maybeSingle();
  if (!flat) {
    return NextResponse.json(
      { error: `${flatNumber} тоот бүртгэлгүй эсвэл идэвхгүй байна` },
      { status: 404 },
    );
  }

  // Давхардлыг ЭНД барина: (flat, category, month) дээр unique индекс байгаа
  // тул DB ч зөвшөөрөхгүй, гэхдээ ойлгомжтой мессеж буцаах нь дээр
  const { data: existing } = await db
    .from('invoices')
    .select('id')
    .eq('flat_id', flat.id)
    .eq('category', category)
    .eq('billing_month', billingMonth)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `${flatNumber} тоотод ${billingMonth} сарын нэхэмжлэл аль хэдийн байна. Жагсаалтаас «Засах» дарна уу.` },
      { status: 409 },
    );
  }

  const entrance = flat.entrance === null ? null : Number(flat.entrance);
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

  const row: Record<string, unknown> = {
    flat_id: flat.id,
    category,
    billing_month: billingMonth,
    note,
  };

  if (category === 'SOH') {
    const billAmount = Number(body.billAmount);
    if (!Number.isFinite(billAmount) || billAmount < 0) {
      return NextResponse.json({ error: 'Дүн буруу байна' }, { status: 400 });
    }
    row.bill_amount = billAmount;
  } else {
    const tariffs = await loadTariffsFor(db, category, billingMonth, entrance);
    if (!tariffs.length) {
      return NextResponse.json(
        { error: `${billingMonth} сард хүчинтэй тариф олдсонгүй` },
        { status: 400 },
      );
    }

    const readings =
      category === 'WATER_HEAT'
        ? {
            hotPrev: Number(body.hotPrev ?? 0),
            hotCurrent: Number(body.hotCurrent ?? 0),
            coldPrev: Number(body.coldPrev ?? 0),
            coldCurrent: Number(body.coldCurrent ?? 0),
          }
        : { prev: Number(body.prevReading ?? 0), current: Number(body.currentReading ?? 0) };

    if (Object.values(readings).some((v) => !Number.isFinite(v) || v < 0)) {
      return NextResponse.json({ error: 'Заалт сөрөг эсвэл тоо биш байна' }, { status: 400 });
    }

    try {
      if (category === 'WATER_HEAT') {
        const r = readings as { hotPrev: number; hotCurrent: number; coldPrev: number; coldCurrent: number };
        const bill = calculateWaterHeat(r, tariffs);
        Object.assign(row, {
          hot_prev: r.hotPrev,
          hot_current: r.hotCurrent,
          cold_prev: r.coldPrev,
          cold_current: r.coldCurrent,
          usage_amount: bill.totalUsage,
          bill_amount: bill.total,
          breakdown: bill.lines,
        });
      } else {
        const r = readings as { prev: number; current: number };
        const bill = calculateElectricity(r, tariffs);
        Object.assign(row, {
          prev_reading: r.prev,
          current_reading: r.current,
          usage_amount: bill.billedKwh,
          bill_amount: bill.total,
          breakdown: bill.lines,
        });
      }
    } catch (error) {
      const message =
        error instanceof WaterHeatError || error instanceof ElectricityError
          ? error.message
          : 'Бодоход алдаа гарлаа';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const { data: created, error } = await db
    .from('invoices')
    .insert(row)
    .select('id, bill_amount')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidateTag('invoices');
  return NextResponse.json({
    ok: true,
    id: created.id,
    flatNumber,
    billAmount: Number(created.bill_amount),
  });
}

/**
 * PATCH /api/admin/invoices — нэхэмжлэл засах
 *
 * Ус дулаан ба цахилгаанд: ЗААЛТЫГ л засна, төлбөрийг систем ДАХИН БОДНО.
 * Админ дүнг гараар бичихгүй — эс бөгөөс Excel-ийн гар засварын асуудал
 * буцаж ирнэ.
 *
 * Тариф нь тухайн САРД хүчинтэй байсныг авна. Тиймээс хуучин сарын
 * нэхэмжлэлийг засахад тэр үеийн тарифаар бодогдоно.
 *
 * СӨХ-д: дүнг шууд засна (Excel-ээс бэлэн ирдэг).
 *
 * Body: { id, hotPrev?, hotCurrent?, coldPrev?, coldCurrent?,
 *         prevReading?, currentReading?, billAmount?, note? }
 */
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const body = (await request.json()) as {
    id?: string;
    hotPrev?: number | string;
    hotCurrent?: number | string;
    coldPrev?: number | string;
    coldCurrent?: number | string;
    prevReading?: number | string;
    currentReading?: number | string;
    billAmount?: number | string;
    note?: string | null;
  };

  if (!body.id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const db = createAdminClient();
  const { data: invoice, error: readError } = await db
    .from('invoices')
    .select('id, category, billing_month, flats(entrance)')
    .eq('id', body.id)
    .single();

  if (readError || !invoice) {
    return NextResponse.json({ error: 'Нэхэмжлэл олдсонгүй' }, { status: 404 });
  }

  // Айл аль орцынх бэ — тариф орцоор ялгаатай байж болно
  const flat = invoice.flats as unknown as { entrance: number | null } | null;
  const entrance = flat?.entrance === null || flat?.entrance === undefined ? null : Number(flat.entrance);

  /** Тухайн сард, тухайн ОРЦОД хүчинтэй байсан тарифыг авна */
  async function loadTariffs(category: string): Promise<TariffRow[]> {
    const monthStart = `${invoice!.billing_month}-01`;
    const { data } = await db
      .from('tariffs')
      .select('code, label, unit, rate, entrance, sort_order')
      .eq('category', category)
      .lte('effective_from', monthStart)
      .or(`effective_to.is.null,effective_to.gte.${monthStart}`)
      .order('sort_order');

    const all: TariffWithEntrance[] = (data ?? []).map((t) => ({
      code: t.code as string,
      label: t.label as string,
      unit: t.unit as TariffRow['unit'],
      rate: Number(t.rate),
      entrance: t.entrance === null ? null : Number(t.entrance),
      sortOrder: Number(t.sort_order),
    }));
    return resolveTariffs(all, entrance);
  }

  // ── Цахилгаан: нэг тоолуурын заалтаас ДАХИН бодно ─────────────────────────
  if (invoice.category === 'ELECTRICITY') {
    const prev = Number(body.prevReading ?? 0);
    const current = Number(body.currentReading ?? 0);
    if (![prev, current].every((v) => Number.isFinite(v) && v >= 0)) {
      return NextResponse.json({ error: 'Заалт сөрөг эсвэл тоо биш байна' }, { status: 400 });
    }

    const tariffs = await loadTariffs('ELECTRICITY');
    if (!tariffs.length) {
      return NextResponse.json(
        { error: `${invoice.billing_month} сард цахилгааны тариф олдсонгүй` },
        { status: 400 },
      );
    }

    let bill;
    try {
      bill = calculateElectricity({ prev, current }, tariffs);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof ElectricityError ? error.message : 'Бодоход алдаа гарлаа' },
        { status: 400 },
      );
    }

    const { error } = await db
      .from('invoices')
      .update({
        prev_reading: prev,
        current_reading: current,
        usage_amount: bill.billedKwh,
        bill_amount: bill.total,
        breakdown: bill.lines,
        note: body.note ?? null,
      })
      .eq('id', invoice.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    revalidateTag('invoices');
    return NextResponse.json({ ok: true, billedKwh: bill.billedKwh, billAmount: bill.total });
  }

  // ── СӨХ: дүнг шууд ────────────────────────────────────────────────────────
  if (invoice.category !== 'WATER_HEAT') {
    const billAmount = Number(body.billAmount);
    if (!Number.isFinite(billAmount) || billAmount < 0) {
      return NextResponse.json({ error: 'Дүн буруу байна' }, { status: 400 });
    }
    const { error } = await db
      .from('invoices')
      .update({ bill_amount: billAmount, note: body.note ?? null })
      .eq('id', invoice.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    revalidateTag('invoices');
    return NextResponse.json({ ok: true, billAmount });
  }

  // ── Ус дулаан: заалтаас ДАХИН бодно ───────────────────────────────────────
  const readings = {
    hotPrev: Number(body.hotPrev ?? 0),
    hotCurrent: Number(body.hotCurrent ?? 0),
    coldPrev: Number(body.coldPrev ?? 0),
    coldCurrent: Number(body.coldCurrent ?? 0),
  };
  if (Object.values(readings).some((v) => !Number.isFinite(v) || v < 0)) {
    return NextResponse.json({ error: 'Заалт сөрөг эсвэл тоо биш байна' }, { status: 400 });
  }

  const tariffs = await loadTariffs('WATER_HEAT');
  if (!tariffs.length) {
    return NextResponse.json(
      { error: `${invoice.billing_month} сард хүчинтэй тариф олдсонгүй` },
      { status: 400 },
    );
  }

  let bill;
  try {
    bill = calculateWaterHeat(readings, tariffs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof WaterHeatError ? error.message : 'Бодоход алдаа гарлаа' },
      { status: 400 },
    );
  }

  const { error } = await db
    .from('invoices')
    .update({
      hot_prev: readings.hotPrev,
      hot_current: readings.hotCurrent,
      cold_prev: readings.coldPrev,
      cold_current: readings.coldCurrent,
      usage_amount: bill.totalUsage,
      bill_amount: bill.total,
      breakdown: bill.lines,
      note: body.note ?? null,
    })
    .eq('id', invoice.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidateTag('invoices');
  return NextResponse.json({
    ok: true,
    hotUsage: bill.hotUsage,
    coldUsage: bill.coldUsage,
    totalUsage: bill.totalUsage,
    billAmount: bill.total,
  });
}

/** DELETE /api/admin/invoices?id=<id> — нэхэмжлэл устгах */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from('invoices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Сүүлийн нэхэмжлэл уствал тэр сар цэснээс шууд алга болно
  revalidateTag('invoices');
  return NextResponse.json({ ok: true });
}
