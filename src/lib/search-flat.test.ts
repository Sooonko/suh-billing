import { matchesSearch } from './search-flat';

/**
 * Хайлтын дүрмийн тест.
 *
 * Гол эрсдэл: байранд 6, 7 тоот ҮНЭХЭЭР байдаг. Хэсэгчилсэн тохирол
 * хийвэл «7» нь 178, 157, 173-ыг татаж, тэр хоёр тоотыг хайх ямар ч
 * арга байхгүй болно.
 *
 * Ажиллуулах: npm run test:search
 */

const cases: [label: string, search: string, row: Parameters<typeof matchesSearch>[1], want: boolean][] = [
  ['«7» → 7 тоот олдоно', '7', { flatNumber: 7, texts: ['АНДРАЙ'] }, true],
  ['«7» → 178 тоотыг ТАТАХГҮЙ', '7', { flatNumber: 178, texts: ['1-178 TOG'] }, false],
  ['«7» → 157 тоотыг ТАТАХГҮЙ', '7', { flatNumber: 157, texts: ['PEACE 1-157'] }, false],
  ['«7» → утганд 7 байсан ч ТАТАХГҮЙ', '7', { flatNumber: 205, texts: ['7 САР ТӨЛБӨР'] }, false],
  ['«6» → 6 тоот олдоно', '6', { flatNumber: 6, texts: [null] }, true],
  ['«178» → 178 олдоно', '178', { flatNumber: 178, texts: [] }, true],
  ['«178» → 17 ТАТАХГҮЙ', '178', { flatNumber: 17, texts: [] }, false],
  ['нэрээр хэсэгчлэн олдоно', 'баяр', { flatNumber: 204, texts: ['БАЯРМАА ДОРЖ'] }, true],
  ['нэр таарахгүй бол олдохгүй', 'ганаа', { flatNumber: 204, texts: ['БАЯРМАА'] }, false],
  ['тоот танигдаагүй мөрийг тоогоор хайхгүй', '7', { flatNumber: null, texts: ['СӨХ-Д'] }, false],
  ['хоосон хайлт бүгдийг гаргана', '  ', { flatNumber: 178, texts: [] }, true],
  ['том/жижиг үсэг хамаагүй', 'АНДРАЙ', { flatNumber: 178, texts: ['андрай золзаяа'] }, true],
];

let ok = 0;
for (const [label, search, row, want] of cases) {
  const got = matchesSearch(search, row);
  const pass = got === want;
  if (pass) ok++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass ? '' : ` — хүлээсэн ${want}, гарсан ${got}`}`);
}
console.log(`\n${ok}/${cases.length} хайлтын тохиолдол зөв`);
