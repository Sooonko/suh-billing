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
 *   FIXED мөрүүд   = тариф                (суурь хураамж, ус халаалт)
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
  /** Хэдэн нэгжид ноогдсон бэ. FIXED-д 1, PERCENT-д дэд дүн */
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
 * @throws WaterHeatError  заалт буурсан үед (тоолуур солигдсон эсвэл
 *         буруу бичсэн). Дуугүй 0 болгохгүй — админ мэдэх ёстой.
 */
export function calculateWaterHeat(
  readings: WaterReadings,
  tariffs: readonly TariffRow[],
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

  // 1. Хэрэглээнээс хамаарах ба тогтмол мөрүүд
  for (const tariff of tariffs) {
    if (tariff.unit === 'PER_M3') {
      lines.push({ ...tariff, qty: totalUsage, amount: money(totalUsage * tariff.rate) });
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
