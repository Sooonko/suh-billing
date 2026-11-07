import type { TariffUnit } from '@/lib/types';

/**
 * Ус, дулааны төлбөрийн тооцоолол.
 *
 * Excel дээр гараар бодохын оронд систем өөрөө бодно. Тариф нь DB-д байгаа
 * тул өөрчлөгдөхөд нэг л газар засна.
 *
 * Томьёо (СӨХ-ийн Excel-тэй тулгаж баталгаажуулсан):
 *
 *   халуун зөрүү = халуун одоо − халуун өмнөх
 *   хүйтэн зөрүү = хүйтэн одоо − хүйтэн өмнөх
 *   нийт м³      = халуун зөрүү + хүйтэн зөрүү
 *
 *   PER_M3 мөрүүд  = нийт м³ × тариф      (цэвэр ус, бохир ус)
 *   PER_M2 мөрүүд  = айлын м² × тариф     (халаалт — 2026-11-ээс)
 *   FIXED мөрүүд   = тариф                (суурь хураамж, ус халаалт, дулааны суурь)
 *   ─────────────────────────────────────
 *   дэд дүн        = дээрх бүгдийн нийлбэр
 *   PERCENT мөрүүд = дэд дүн × хувь       (НӨАТ)
 *   нийт төлбөр    = дэд дүн + НӨАТ
 */

export interface TariffRow {
  code: string;
  label: string;
  unit: TariffUnit;
  rate: number;
}

export interface WaterReadings {
  hotPrev: number;
  hotCurrent: number;
  coldPrev: number;
  coldCurrent: number;
}

/** Нэхэмжлэлийн нэг мөр — оршин суугчид задаргаа болгон харуулна */
export interface BillLine {
  code: string;
  label: string;
  unit: TariffUnit;
  /** Тухайн үед хүчинтэй байсан тариф — ХАДГАЛАГДАНА */
  rate: number;
  /** Хэдэн нэгжид ноогдсон бэ. PER_M3-д м³, PER_M2-д талбай, FIXED-д 1, PERCENT-д дэд дүн */
  qty: number;
  amount: number;
}

export interface WaterHeatBill {
  hotUsage: number;
  coldUsage: number;
  totalUsage: number;
  lines: BillLine[];
  /** НӨАТ-гүй дүн */
  subtotal: number;
  vat: number;
  /** invoices.bill_amount болж очих тоо */
  total: number;
}

/** Мөнгөн дүнг 2 орон хүртэл — DB-ийн numeric(14,2)-той таарна */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export class WaterHeatError extends Error {}

/**
 * Нэг айлын ус дулааны төлбөрийг бодно.
 *
 * @param area  айлын талбай (м²) — PER_M2 тариф хүчинтэй сард заавал
 * @throws WaterHeatError  заалт буурсан, эсвэл м² тариф байхад талбай
 *         бүртгэгдээгүй үед. Дуугүй 0 болгохгүй — админ мэдэх ёстой.
 */
export function calculateWaterHeat(
  readings: WaterReadings,
  tariffs: readonly TariffRow[],
  area: number | null = null,
): WaterHeatBill {
  const hotUsage = money(readings.hotCurrent - readings.hotPrev);
  const coldUsage = money(readings.coldCurrent - readings.coldPrev);

  if (hotUsage < 0 || coldUsage < 0) {
    throw new WaterHeatError(
      `Заалт буурсан байна (халуун ${readings.hotPrev}→${readings.hotCurrent}, ` +
        `хүйтэн ${readings.coldPrev}→${readings.coldCurrent}). Тоолуур солигдсон эсэхийг шалгана уу.`,
    );
  }

  const totalUsage = money(hotUsage + coldUsage);
  const lines: BillLine[] = [];

  // Талбайгүй айлд халаалтыг 0 гэж бодвол тэр айл халаалтын төлбөргүй гарна
  if (tariffs.some((t) => t.unit === 'PER_M2') && !(area !== null && area > 0)) {
    throw new WaterHeatError('Айлын талбай (м²) бүртгэгдээгүй — халаалтын төлбөр бодох боломжгүй.');
  }

  // 1. Хэрэглээнээс хамаарах ба тогтмол мөрүүд
  for (const tariff of tariffs) {
    if (tariff.unit === 'PER_M3') {
      lines.push({ ...tariff, qty: totalUsage, amount: money(totalUsage * tariff.rate) });
    } else if (tariff.unit === 'PER_M2') {
      lines.push({ ...tariff, qty: area!, amount: money(area! * tariff.rate) });
    } else if (tariff.unit === 'FIXED') {
      lines.push({ ...tariff, qty: 1, amount: money(tariff.rate) });
    }
  }

  const subtotal = money(lines.reduce((sum, line) => sum + line.amount, 0));

  // 2. Хувиар бодогдох мөрүүд — дэд дүнгээс
  let vat = 0;
  for (const tariff of tariffs) {
    if (tariff.unit !== 'PERCENT') continue;
    const amount = money((subtotal * tariff.rate) / 100);
    vat = money(vat + amount);
    lines.push({ ...tariff, qty: subtotal, amount });
  }

  return {
    hotUsage,
    coldUsage,
    totalUsage,
    lines,
    subtotal,
    vat,
    total: money(subtotal + vat),
  };
}
