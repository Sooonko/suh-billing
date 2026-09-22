import type { TariffUnit } from '@/lib/types';
import type { BillLine, TariffRow } from './water-heat';

/**
 * Цахилгааны төлбөрийн тооцоолол.
 *
 * Уснаас ЯЛГААТАЙ: нэг тоолуур, гэхдээ хоёр бүрэлдэхүүнтэй —
 * хэрэглэсэн эрчим хүч, дээр нь дундаж ЧАДЛЫН төлбөр.
 *
 * Томьёо (СӨХ-ийн Excel-тэй тулгаж баталгаажуулсан, 207/207 мөр таарсан):
 *
 *   зөрүү         = заалт(энэ сар) − заалт(өмнөх сар)
 *   квт·ц         = зөрүү × LOSS_COEF            (1.025 — сүлжээний алдагдал)
 *   эрчим хүч     = квт·ц × ENERGY_RATE          (265 ₮/кВт·ц)
 *
 *   дундаж чадал  = квт·ц ÷ DAYS ÷ HOURS         (кВт)
 *   чадлын төлбөр = дундаж чадал × CAPACITY_RATE (15,500 ₮/кВт)
 *   ────────────────────────────────────────────
 *   нийлбэр       = эрчим хүч + чадлын төлбөр
 *   НӨАТ          = нийлбэр × VAT%
 *   нийт          = нийлбэр + НӨАТ
 *
 * DAYS, HOURS нь тарифын хүснэгтэд NUMBER төрлөөр байна — мөнгө биш,
 * томьёоны хуваарь. /admin/tariffs цэсээс засна.
 */

export interface ElectricityReadings {
  prev: number;
  current: number;
}

export interface ElectricityBill {
  /** Тоолуурын цэвэр зөрүү */
  rawUsage: number;
  /** Алдагдлын коэфф хэрэглэсний дараах кВт·ц */
  billedKwh: number;
  /** Дундаж чадал (кВт) */
  averageLoad: number;
  lines: BillLine[];
  subtotal: number;
  vat: number;
  /** invoices.bill_amount болж очих тоо */
  total: number;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export class ElectricityError extends Error {}

/** Тарифын жагсаалтаас код нэрээр утга олох */
function rateOf(tariffs: readonly TariffRow[], code: string): TariffRow | undefined {
  return tariffs.find((t) => t.code === code);
}

/**
 * Нэг айлын цахилгааны төлбөрийг бодно.
 *
 * @throws ElectricityError  заалт буурсан эсвэл тариф дутуу үед. Дуугүй 0
 *         болгохгүй — админ мэдэх ёстой.
 */
export function calculateElectricity(
  readings: ElectricityReadings,
  tariffs: readonly TariffRow[],
): ElectricityBill {
  const rawUsage = money(readings.current - readings.prev);
  if (rawUsage < 0) {
    throw new ElectricityError(
      `Заалт буурсан байна (${readings.prev} → ${readings.current}). ` +
        `Тоолуур солигдсон эсвэл эргэсэн эсэхийг шалгана уу.`,
    );
  }

  const required = ['LOSS_COEF', 'ENERGY_RATE', 'DAYS', 'HOURS', 'CAPACITY_RATE'];
  const missing = required.filter((code) => !rateOf(tariffs, code));
  if (missing.length) {
    throw new ElectricityError(`Тариф дутуу байна: ${missing.join(', ')}`);
  }

  const lossCoef = rateOf(tariffs, 'LOSS_COEF')!;
  const energyRate = rateOf(tariffs, 'ENERGY_RATE')!;
  const days = rateOf(tariffs, 'DAYS')!;
  const hours = rateOf(tariffs, 'HOURS')!;
  const capacityRate = rateOf(tariffs, 'CAPACITY_RATE')!;

  if (days.rate <= 0 || hours.rate <= 0) {
    throw new ElectricityError('Хоног ба Цаг тэгээс их байх ёстой');
  }

  // Excel-тэй яг таарахын тулд ЭНД дугуйруулахгүй — эцсийн дүн дээр л
  // дугуйруулна. Дунд алхамд дугуйруулбал ₮-ийн зөрүү үүснэ.
  const billedKwh = rawUsage * lossCoef.rate;
  const averageLoad = billedKwh / days.rate / hours.rate;

  const lines: BillLine[] = [
    {
      code: energyRate.code,
      label: energyRate.label,
      unit: energyRate.unit as TariffUnit,
      rate: energyRate.rate,
      qty: money(billedKwh),
      amount: money(billedKwh * energyRate.rate),
    },
    {
      code: capacityRate.code,
      label: capacityRate.label,
      unit: capacityRate.unit as TariffUnit,
      rate: capacityRate.rate,
      qty: Math.round(averageLoad * 10000) / 10000,
      amount: money(averageLoad * capacityRate.rate),
    },
  ];

  const subtotal = money(lines.reduce((sum, line) => sum + line.amount, 0));

  let vat = 0;
  for (const tariff of tariffs) {
    if (tariff.unit !== 'PERCENT') continue;
    const amount = money((subtotal * tariff.rate) / 100);
    vat = money(vat + amount);
    lines.push({ ...tariff, qty: subtotal, amount });
  }

  return {
    rawUsage,
    billedKwh: money(billedKwh),
    averageLoad: Math.round(averageLoad * 10000) / 10000,
    lines,
    subtotal,
    vat,
    total: money(subtotal + vat),
  };
}
