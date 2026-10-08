import { pageNumbers, paginate, parsePaging } from './pagination';

/**
 * Хуудаслалтын тест.
 *
 * Гол эрсдэл: URL-д буруу утга (`?page=abc`, `?size=99999`) ирэхэд
 * хуудас унах, эсвэл шүүлт хийсний дараа хуудас хэтэрч ХООСОН дэлгэц
 * гарах. Мөн «11–20» гэх хүрээ нэгээр зөрөх.
 *
 * Ажиллуулах: npm run test:pagination
 */

const rows = Array.from({ length: 23 }, (_, i) => i + 1);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const cases: [label: string, got: unknown, want: unknown][] = [
  ['анхдагч: 1-р хуудас, 10 мөр', parsePaging({}), { page: 1, size: 10 }],
  ['зөвшөөрөгдсөн хэмжээ', parsePaging({ size: '50' }), { page: 1, size: 50 }],
  ['200 зөвшөөрөгдөнө', parsePaging({ size: '200' }), { page: 1, size: 200 }],
  ['зөвшөөрөгдөөгүй хэмжээ → 10', parsePaging({ size: '99999' }), { page: 1, size: 10 }],
  ['үсэг → анхдагч', parsePaging({ page: 'abc', size: 'x' }), { page: 1, size: 10 }],
  ['сөрөг хуудас → 1', parsePaging({ page: '-3' }), { page: 1, size: 10 }],
  ['бутархай хуудас → 1', parsePaging({ page: '2.5' }), { page: 1, size: 10 }],
  ['массив утга → эхнийх', parsePaging({ page: ['3', '9'] }), { page: 3, size: 10 }],

  ['1-р хуудас 1–10', (({ from, to, pageCount }) => ({ from, to, pageCount }))(paginate(rows, { page: 1, size: 10 })), { from: 1, to: 10, pageCount: 3 }],
  ['2-р хуудасны мөрүүд 11..20', paginate(rows, { page: 2, size: 10 }).rows, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]],
  ['сүүлийн хуудас дутуу: 21–23', (({ from, to, rows: r }) => ({ from, to, r }))(paginate(rows, { page: 3, size: 10 })), { from: 21, to: 23, r: [21, 22, 23] }],
  ['хэтэрсэн хуудас → сүүлийнх руу', (({ page, rows: r }) => ({ page, r }))(paginate(rows, { page: 9, size: 10 })), { page: 3, r: [21, 22, 23] }],
  ['хоосон жагсаалт: 0–0, 1 хуудас', (({ from, to, page, pageCount, rows: r }) => ({ from, to, page, pageCount, r }))(paginate([], { page: 4, size: 10 })), { from: 0, to: 0, page: 1, pageCount: 1, r: [] }],
  ['яг дүүрэн: 20 мөр / 10 → 2 хуудас', paginate(rows.slice(0, 20), { page: 1, size: 10 }).pageCount, 2],

  ['цөөн хуудас бүгд харагдана', pageNumbers(2, 3), [1, 2, 3]],
  ['7 хуудас бүгд', pageNumbers(4, 7), [1, 2, 3, 4, 5, 6, 7]],
  ['эхэнд: 1 2 3 4 5 … 20', pageNumbers(1, 20), [1, 2, 3, 4, 5, '…', 20]],
  ['дунд: 1 … 9 10 11 … 20', pageNumbers(10, 20), [1, '…', 9, 10, 11, '…', 20]],
  ['төгсгөлд: 1 … 16 17 18 19 20', pageNumbers(20, 20), [1, '…', 16, 17, 18, 19, 20]],
];

let ok = 0;
for (const [label, got, want] of cases) {
  const pass = same(got, want);
  if (pass) ok++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass ? '' : ` — хүлээсэн ${JSON.stringify(want)}, гарсан ${JSON.stringify(got)}`}`);
}
console.log(`\n${ok}/${cases.length} хуудаслалтын тохиолдол зөв`);
if (ok !== cases.length) process.exit(1);
