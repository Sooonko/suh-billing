import type { SupabaseClient } from '@supabase/supabase-js';
import type { TariffWithEntrance } from './resolve-tariffs';
import type { TariffRow } from './water-heat';

/**
 * Тухайн сард ХҮЧИНТЭЙ тарифыг авах — нэхэмжлэл бодох БҮХ газар үүнийг
 * дуудна (Excel импорт, гараар нэмэх, заалт засах). Хуулбар байвал нэг нь
 * өөрчлөгдөхөд нөгөө нь хоцорч, ижил заалт хоёр өөр дүн өгнө.
 *
 * Хоёр шүүлт:
 *  1. Огноо — сарын эхний өдөр effective_from…effective_to дотор байх.
 *     Тариф дунд сараас өөрчлөгдвөл тухайн сар хуучнаараа бодогдоно.
 *  2. Улирал — `seasonal` тариф (халаалт) зөвхөн heating_seasons-д орсон
 *     сард. Үнэ нь тарифт, хугацаа нь улиралд — дараа жил зөвхөн улирал
 *     нэмнэ.
 */
export async function loadTariffsForMonth(
  db: SupabaseClient,
  category: string,
  billingMonth: string,
): Promise<TariffWithEntrance[]> {
  const monthStart = `${billingMonth}-01`;

  const { data } = await db
    .from('tariffs')
    .select('code, label, unit, rate, entrance, sort_order, seasonal')
    .eq('category', category)
    .lte('effective_from', monthStart)
    .or(`effective_to.is.null,effective_to.gte.${monthStart}`)
    .order('sort_order');

  const rows = data ?? [];
  const heating = rows.some((t) => t.seasonal) ? await isHeatingMonth(db, billingMonth) : false;

  return rows
    .filter((t) => !t.seasonal || heating)
    .map((t) => ({
      code: t.code as string,
      label: t.label as string,
      unit: t.unit as TariffRow['unit'],
      rate: Number(t.rate),
      entrance: t.entrance === null ? null : Number(t.entrance),
      sortOrder: Number(t.sort_order),
    }));
}

/** 'YYYY-MM' нь аль нэг халаалтын улиралд (эхлэл, төгсгөл хоёулаа ОРНО) багтах эсэх */
export function monthInSeasons(month: string, seasons: { start_month: string; end_month: string }[]): boolean {
  return seasons.some((s) => s.start_month <= month && month <= s.end_month);
}

async function isHeatingMonth(db: SupabaseClient, month: string): Promise<boolean> {
  const { data, error } = await db
    .from('heating_seasons')
    .select('start_month, end_month')
    .lte('start_month', month)
    .gte('end_month', month);
  // Хүснэгт үүсээгүй бол халаалт БОДОХГҮЙ байхаас илүү алдаа өгөх нь зөв —
  // эс бөгөөс бүх айл халаалтгүй нэхэмжлэл авна
  if (error) throw new Error(`Халаалтын улирал уншигдсангүй: ${error.message}`);
  return monthInSeasons(month, data ?? []);
}
