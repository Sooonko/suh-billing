import { splitDebtByMonth, debtForMonth, type InvoiceLine } from './fifo-debt';
import type { BillCategory } from '@/lib/types';

/**
 * FIFO өр задаргааны тест.
 *
 * Гол эрсдэл: оршин суугч 9 сарын төлбөрөө 10 сард төлсөн бол «9 сар
 * төлөөгүй» гэж буруу харуулах. Тиймээс сараар шүүхэд ЯГ аль сар нь
 * хаагдсаныг тулгана.
 *
 * Ажиллуулах: npm run test:fifo
 */

const W: BillCategory = 'WATER_HEAT';
const S: BillCategory = 'SOH';

interface Scenario {
  name: string;
  invoices: InvoiceLine[];
  paid: [BillCategory, number][];
  /** [сар, ангилал, хүлээсэн үлдэгдэл] */
  want: [string, BillCategory, number][];
}

const scenarios: Scenario[] = [
  {
    name: 'Юу ч төлөөгүй — 2 сар бүтэн өртэй',
    invoices: [
      { month: '2026-08', category: W, billed: 50_000 },
      { month: '2026-09', category: W, billed: 60_000 },
    ],
    paid: [],
    want: [
      ['2026-08', W, 50_000],
      ['2026-09', W, 60_000],
    ],
  },
  {
    name: '8 сарынхыг бүтэн төлсөн — 9 сар л өртэй',
    invoices: [
      { month: '2026-08', category: W, billed: 50_000 },
      { month: '2026-09', category: W, billed: 60_000 },
    ],
    paid: [[W, 50_000]],
    want: [
      ['2026-08', W, 0],
      ['2026-09', W, 60_000],
    ],
  },
  {
    // ХАМГИЙН ЧУХАЛ: 9 сард төлөөгүй ч 10 сард төлсөн бол 9 сар хаагдана
    name: 'Хоцроод төлсөн — хуучин сар эхэлж хаагдана',
    invoices: [
      { month: '2026-08', category: W, billed: 50_000 },
      { month: '2026-09', category: W, billed: 60_000 },
    ],
    paid: [[W, 80_000]],
    want: [
      ['2026-08', W, 0],
      ['2026-09', W, 30_000],
    ],
  },
  {
    name: 'Илүү төлсөн — сарын задаргаанд сөрөг тоо гарахгүй',
    invoices: [{ month: '2026-09', category: W, billed: 60_000 }],
    paid: [[W, 100_000]],
    want: [['2026-09', W, 0]],
  },
  {
    // Ангилал бүр ТУСДАА сан — усны төлбөр СӨХ-ийн өрийг хаахгүй
    name: 'Ангиллууд хоорондоо холилдохгүй',
    invoices: [
      { month: '2026-09', category: W, billed: 60_000 },
      { month: '2026-09', category: S, billed: 35_000 },
    ],
    paid: [[W, 60_000]],
    want: [
      ['2026-09', W, 0],
      ['2026-09', S, 35_000],
    ],
  },
  {
    name: 'Дутуу төлсөн — зөрүү нь өр',
    invoices: [{ month: '2026-09', category: S, billed: 35_000 }],
    paid: [[S, 20_000]],
    want: [['2026-09', S, 15_000]],
  },
];

let ok = 0;
for (const sc of scenarios) {
  const rows = splitDebtByMonth(sc.invoices, new Map(sc.paid));
  const fails: string[] = [];

  for (const [month, category, want] of sc.want) {
    const got = rows.find((r) => r.month === month && r.category === category)?.remaining;
    if (got !== want) fails.push(`${month}/${category}: хүлээсэн ${want}, гарсан ${got}`);
  }

  // нэхэмжилсэн = төлсөн + үлдсэн гэсэн тэнцэл үргэлж хүчинтэй байх ёстой
  for (const r of rows) {
    if (Math.abs(r.billed - (r.paid + r.remaining)) > 0.005) {
      fails.push(`${r.month}/${r.category}: тэнцэл зөрсөн`);
    }
  }

  if (fails.length === 0) ok++;
  console.log(`  ${fails.length === 0 ? '✅' : '❌'} ${sc.name}`);
  fails.forEach((f) => console.log(`       ${f}`));
}

// debtForMonth нь сонгосон сарын мөрийг ангиллаар индексжүүлнэ
const picked = debtForMonth(
  splitDebtByMonth(
    [
      { month: '2026-08', category: W, billed: 50_000 },
      { month: '2026-09', category: W, billed: 60_000 },
      { month: '2026-09', category: S, billed: 35_000 },
    ],
    new Map<BillCategory, number>([[W, 50_000]]),
  ),
  '2026-09',
);
const pickOk = picked.size === 2 && picked.get(W)?.remaining === 60_000 && picked.get(S)?.remaining === 35_000;
if (pickOk) ok++;
console.log(`  ${pickOk ? '✅' : '❌'} debtForMonth — сонгосон сарыг ангиллаар салгана`);

console.log(`\n${ok}/${scenarios.length + 1} FIFO тохиолдол зөв`);
