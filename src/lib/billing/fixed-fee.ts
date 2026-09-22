import type { BillLine, TariffRow } from './water-heat';

/**
 * Тоолуургүй ангиллын төлбөр — СӨХ гэх мэт.
 *
 * Хэрэглээнээс хамаарахгүй тул зөвхөн FIXED мөрүүдийг нийлүүлээд, PERCENT
 * (НӨАТ) байвал дээр нь нэмнэ. Одоогоор СӨХ-д НӨАТ байхгүй ч тарифын
 * хүснэгтэд нэмэхэд код өөрчлөхгүйгээр ажиллана.
 */

export interface FixedFeeBill {
  lines: BillLine[];
  subtotal: number;
  vat: number;
  /** invoices.bill_amount болж очих тоо */
  total: number;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export class FixedFeeError extends Error {}

export function calculateFixedFee(tariffs: readonly TariffRow[]): FixedFeeBill {
  const fixed = tariffs.filter((t) => t.unit === 'FIXED');
  if (!fixed.length) {
    throw new FixedFeeError('FIXED төрлийн тариф олдсонгүй');
  }

  const lines: BillLine[] = fixed.map((tariff) => ({
    ...tariff,
    qty: 1,
    amount: money(tariff.rate),
  }));

  const subtotal = money(lines.reduce((sum, line) => sum + line.amount, 0));

  let vat = 0;
  for (const tariff of tariffs) {
    if (tariff.unit !== 'PERCENT') continue;
    const amount = money((subtotal * tariff.rate) / 100);
    vat = money(vat + amount);
    lines.push({ ...tariff, qty: subtotal, amount });
  }

  return { lines, subtotal, vat, total: money(subtotal + vat) };
}
