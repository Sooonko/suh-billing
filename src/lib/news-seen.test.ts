import { isRecent, relativeTime, shortDate, unseenOf } from './news-seen';

/**
 * Мэдээний «шинэ» тэмдэг ба цагийн бичиглэлийн тест.
 *
 * Гол эрсдэл: анх орж буй хүнд хуучин зарлал «шинэ» гэж гарах, эсвэл
 * «Өчигдөр» гэх бичиглэл шөнө дундын орчим буруу гарах.
 *
 * Ажиллуулах: npm run test:news
 */

// Орон нутгийн цагаар 2026-10-08 14:30
const now = new Date(2026, 9, 8, 14, 30).getTime();
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

const items = [
  { id: 'a', published_at: at(2026, 10, 8, 9) }, // өнөөдөр
  { id: 'b', published_at: at(2026, 9, 20) }, // 18 хоногийн өмнө
  { id: 'c', published_at: at(2026, 8, 1) }, // 2 сарын өмнө — шинэ БИШ
  { id: 'd', published_at: 'эвдэрсэн' }, // буруу огноо — шинэ БИШ
];

const cases: [label: string, got: unknown, want: unknown][] = [
  ['өнөөдрийнх шинэ', isRecent(items[0].published_at, now), true],
  ['2 сарын өмнөх шинэ биш', isRecent(items[2].published_at, now), false],
  ['буруу огноо шинэ биш', isRecent('эвдэрсэн', now), false],
  ['хараагүй + 30 хоногт → a, b', unseenOf(items, new Set(), now).map((i) => i.id), ['a', 'b']],
  ['a-г харсан бол → b', unseenOf(items, new Set(['a']), now).map((i) => i.id), ['b']],
  ['бүгдийг харсан → хоосон', unseenOf(items, new Set(['a', 'b', 'c']), now).length, 0],

  ['30 секунд → Дөнгөж сая', relativeTime(new Date(now - 30_000).toISOString(), now), 'Дөнгөж сая'],
  ['15 минут', relativeTime(new Date(now - 15 * 60_000).toISOString(), now), '15 минутын өмнө'],
  ['5 цаг', relativeTime(at(2026, 10, 8, 9, 30), now), '5 цагийн өмнө'],
  ['өчигдөр 23:00 (15.5 цаг) → 15 цаг', relativeTime(at(2026, 10, 7, 23), now), '15 цагийн өмнө'],
  ['өчигдөр 08:00 (30 цаг) → Өчигдөр', relativeTime(at(2026, 10, 7, 8), now), 'Өчигдөр'],
  ['3 өдрийн өмнө', relativeTime(at(2026, 10, 5, 20), now), '3 өдрийн өмнө'],
  ['10 хоног → огноо', relativeTime(at(2026, 9, 28), now), '9 сарын 28'],
  ['өнгөрсөн он → онтой', relativeTime(at(2025, 12, 30), now), '2025 оны 12 сарын 30'],
  ['ирээдүйн огноо (цаг зөрсөн) → Дөнгөж сая', relativeTime(new Date(now + 60_000).toISOString(), now), 'Дөнгөж сая'],
  ['shortDate онгүй', shortDate(at(2026, 9, 18)), '9 сарын 18'],
  ['shortDate буруу → хоосон', shortDate('x'), ''],
];

let ok = 0;
for (const [label, got, want] of cases) {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (pass) ok++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass ? '' : ` — хүлээсэн ${JSON.stringify(want)}, гарсан ${JSON.stringify(got)}`}`);
}
console.log(`\n${ok}/${cases.length} мэдээний тохиолдол зөв`);
if (ok !== cases.length) process.exit(1);
