import { SETTLED_EPSILON, hasDebt, hasOverpaid, isSettled, overpayOf, settledBalance } from './money';

/**
 * Мөнгөний хүлцлийн тест.
 *
 * ЯАГААД ЭНЭ ФАЙЛ ХЭРЭГТЭЙ ВЭ: 50₮-ын хүлцлийг мартсанаас үүдсэн алдаа
 * дараалан 5 удаа гарсан — 115, 105, 107, 114 тоот дээр «дутуу төлсөн»
 * гэж буруу гарсан, дараа нь хуулга оруулахад «Илүү төлөлт: 0₮» гэсэн
 * утгагүй анхааруулга гарсан. Хил нь нэг газраас удирдагдаж, зан нь
 * тестээр бэхлэгдсэн байх ёстой.
 */

type Case<T> = [name: string, actual: T, expected: T];

function run<T>(title: string, cases: Case<T>[]): number {
  console.log(`\n${title}`);
  let ok = 0;
  for (const [name, actual, expected] of cases) {
    const pass = actual === expected;
    if (pass) ok++;
    console.log(
      `  ${pass ? '✅' : '❌'} ${name.padEnd(46)} → ${String(actual)}${pass ? '' : `  (хүлээсэн ${String(expected)})`}`,
    );
  }
  return ok;
}

let ok = 0;
let total = 0;

const thresholdCases: Case<boolean>[] = [
  ['0.02₮ үлдэгдэл — хаагдсан гэж үзнэ', isSettled(0.02), true],
  ['49.99₮ үлдэгдэл — хаагдсан гэж үзнэ', isSettled(49.99), true],
  ['50₮ үлдэгдэл — БОДИТ өр', isSettled(50), false],
  ['−49₮ үлдэгдэл — хаагдсан гэж үзнэ', isSettled(-49), true],
  ['0.86₮ нь өр БИШ', hasDebt(0.86), false],
  ['50₮ нь өр', hasDebt(50), true],
  ['−0.5₮ нь илүү төлөлт БИШ', hasOverpaid(-0.5), false],
  ['−50₮ нь илүү төлөлт', hasOverpaid(-50), true],
];
total += thresholdCases.length;
ok += run('Хүлцлийн хил:', thresholdCases);

const displayCases: Case<number>[] = [
  ['0.86₮ → харуулахдаа 0', settledBalance(0.86), 0],
  ['−0.02₮ → харуулахдаа 0', settledBalance(-0.02), 0],
  ['1,200₮ → хэвээр', settledBalance(1200), 1200],
];
total += displayCases.length;
ok += run('Харуулах үлдэгдэл:', displayCases);

/**
 * Илүү төлөлт — хуулга оруулахад анхааруулах эсэх.
 *
 * `null` нь «анхааруулах шаардлагагүй».
 */
const overpayCases: Case<number | null>[] = [
  ['яг бүтэн төлсөн (65,161 / 65,161)', overpayOf(65161, 65161), null],
  ['0.33₮ үлдэц — анхааруулахгүй', overpayOf(65161, 65160.67), null],
  ['49₮ зөрүү — анхааруулахгүй', overpayOf(10049, 10000), null],
  ['50₮ зөрүү — анхааруулна', overpayOf(10050, 10000), 50],
  ['өргүй айл 600,000₮ төлсөн', overpayOf(600000, 0), 600000],
  ['аль хэдийн илүү төлсөн айл (сөрөг үлдэгдэл)', overpayOf(35000, -12000), 35000],
  ['дутуу төлсөн — илүү төлөлт биш', overpayOf(20000, 65161), null],
];
total += overpayCases.length;
ok += run('Илүү төлөлт:', overpayCases);

console.log(`\nХил = ${SETTLED_EPSILON}₮`);
console.log(`${ok}/${total} мөнгөний тохиолдол зөв`);
if (ok !== total) process.exitCode = 1;
