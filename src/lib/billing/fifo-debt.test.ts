import {
  allocatePaymentsToMonths,
  debtForMonth,
  splitDebtByMonth,
  type InvoiceLine,
} from './fifo-debt';
import { hasDebt } from '@/lib/money';
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

// ── Мөнгөний нарийвчлалын хил ───────────────────────────────────────────
// Нэхэмжлэл аравтын оронтой, төлбөр бүхэл төгрөгөөр ирдэг тул бага зэргийн
// үлдэгдэл үүсдэг. Түүнийг «өр» гэж үзвэл айл бүтэн төлсөн ч «дутуу
// төлсөн» гэж харагдана (115 тоот · цахилгаан · 0.02₮).
{
  const rows = splitDebtByMonth(
    [
      { month: '2026-08', category: W, billed: 42_183.54 },
      { month: '2026-09', category: W, billed: 43_220.84 },
    ],
    new Map<BillCategory, number>([[W, 85_404.36]]),
  );
  const residue = rows.reduce((sum, r) => sum + r.remaining, 0);
  const pass = Math.abs(residue - 0.02) < 0.0001 && !hasDebt(residue);
  console.log(
    `  ${pass ? '✅' : '❌'} Аравтын үлдэгдэл ${residue.toFixed(2)}₮ нь өр гэж тооцогдохгүй`,
  );
}

// ── Төлбөр аль сарыг хассан бэ ──────────────────────────────────────────
// 116 тоотын жинхэнэ тохиолдол: 9 сарын 4-нд 8 САРЫНХАА төлбөрийг төлсөн.
// Хүснэгт «9 сарын нэхэмжлэл» гэж харуулдаг тул «9 сараа дутуу төлсөн»
// мэт харагдаж байв.
{
  const invoices: InvoiceLine[] = [
    { month: '2026-08', category: W, billed: 62_260 },
    { month: '2026-09', category: W, billed: 121_220 },
  ];
  const cover = allocatePaymentsToMonths(invoices, [
    { id: 'a', category: W, date: '2026-09-04T00:00:00Z', amount: 62_260 },
  ]);
  const covers = cover.get('a') ?? [];
  const pass = covers.length === 1 && covers[0].month === '2026-08' && covers[0].amount === 62_260;
  console.log(`  ${pass ? '✅' : '❌'} 9 сард хийсэн төлбөр 8 САРЫГ хассан гэж гарна`);
}
{
  // Нэг төлбөр хоёр сарыг хасах тохиолдол
  const cover = allocatePaymentsToMonths(
    [
      { month: '2026-08', category: W, billed: 30_000 },
      { month: '2026-09', category: W, billed: 50_000 },
    ],
    [{ id: 'b', category: W, date: '2026-09-20T00:00:00Z', amount: 45_000 }],
  );
  const c = cover.get('b') ?? [];
  const pass =
    c.length === 2 && c[0].month === '2026-08' && c[0].amount === 30_000 && c[1].amount === 15_000;
  console.log(`  ${pass ? '✅' : '❌'} Нэг төлбөр хоёр сарыг хасвал тус тусад нь хэлнэ`);
}
{
  // Илүү төлөлт ямар ч сард наалдахгүй
  const cover = allocatePaymentsToMonths(
    [{ month: '2026-09', category: W, billed: 10_000 }],
    [
      { id: 'c1', category: W, date: '2026-09-01T00:00:00Z', amount: 10_000 },
      { id: 'c2', category: W, date: '2026-09-02T00:00:00Z', amount: 5_000 },
    ],
  );
  const pass = (cover.get('c1') ?? []).length === 1 && (cover.get('c2') ?? []).length === 0;
  console.log(`  ${pass ? '✅' : '❌'} Илүү төлөлт ямар ч сард наалдахгүй`);
}

// ── Ирээдүйн сар руу халихгүй ───────────────────────────────────────────
// 8 сарын 15-нд төлсөн мөнгө 9 сарын нэхэмжлэлийг хааж болохгүй — тэр
// үед 9 сарын нэхэмжлэл БАЙГААГҮЙ. Хязгаарлахгүй бол дэлгэц дээр
// «8 сарын 15 · 9 сар 2,874₮» гэсэн утгагүй мөр гардаг.
{
  const cover = allocatePaymentsToMonths(
    [
      { month: '2026-08', category: W, billed: 59_126 },
      { month: '2026-09', category: W, billed: 72_957 },
    ],
    [{ id: 'aug', category: W, date: '2026-08-15T00:00:00Z', amount: 62_000 }],
  );
  const c = cover.get('aug') ?? [];
  const pass = c.length === 1 && c[0].month === '2026-08';
  console.log(
    `  ${pass ? '✅' : '❌'} 8 сард төлсөн мөнгө 9 сарыг хаахгүй` +
      (pass ? '' : ` (гарсан: ${c.map((x) => x.month).join(', ')})`),
  );
}

// ── Илүү төлөлт дараагийн нэхэмжлэлд шилжинэ ─────────────────────────────
// Жинхэнэ тохиолдол (цахилгаан): 8 сарын 14-нд 48,431₮ төлсөн, 8 сарын
// нэхэмжлэл 46,333₮ → 2,098₮ илүү. 10 сард 20,400₮-ийн эсрэг 18,302₮
// төлсөн. Өмнө нь 10 сар «2,098₮ дутуу» гэж харагддаг байв — нийт
// үлдэгдэл 0 байхад.
{
  const E: BillCategory = 'ELECTRICITY';
  const cover = allocatePaymentsToMonths(
    [
      { month: '2026-08', category: E, billed: 46_333 },
      { month: '2026-09', category: E, billed: 51_173 },
      { month: '2026-10', category: E, billed: 20_400 },
    ],
    [
      { id: 'e8', category: E, date: '2026-08-14T00:00:00Z', amount: 48_431 },
      { id: 'e9', category: E, date: '2026-09-22T00:00:00Z', amount: 51_173 },
      { id: 'e10', category: E, date: '2026-10-07T00:00:00Z', amount: 18_302 },
    ],
  );
  const [aug] = cover.get('e8') ?? [];
  const [sep] = cover.get('e9') ?? [];
  const [oct] = cover.get('e10') ?? [];
  // 9 сард: 2,098 илүү төлөлт хасагдаад 49,075 үлдэнэ → 51,173 төлөхөд дахиад 2,098 илүү
  const pass =
    aug.amount === 46_333 &&
    sep.credit === 2_098 && sep.before === 49_075 && sep.amount === 49_075 && sep.after === 0 &&
    oct.credit === 2_098 && oct.before === 18_302 && oct.amount === 18_302 && oct.after === 0;
  console.log(`  ${pass ? '✅' : '❌'} Илүү төлөлт дараагийн сарын нэхэмжлэлээс хасагдана (10 сар дутуу биш)`);
}
