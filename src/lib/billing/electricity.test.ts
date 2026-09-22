import * as XLSX from 'xlsx';
import { calculateElectricity, ElectricityError } from './electricity';
import { createFlatResolver } from './flat-resolver';
import { detectElectricityColumns, parseElectricityInvoices } from '@/lib/matching/parse-electricity-invoices';
import { gridToRows } from '@/lib/read-sheet';
import type { TariffRow } from './water-heat';

/**
 * Цахилгааны БҮХЭЛ гинжийн тест — СӨХ-ийн жинхэнэ хүснэгтийн бүтцээр.
 *
 * Тоонууд нь 2026 оны 9 сарын файлаас авсан жинхэнэ мөрүүд.
 *
 * Ажиллуулах: npm run test:electricity
 */
const TARIFFS: TariffRow[] = [
  { code: 'LOSS_COEF', label: 'Алдагдлын коэффициент', unit: 'NUMBER', rate: 1.025 },
  { code: 'ENERGY_RATE', label: 'Эрчим хүчний тариф', unit: 'PER_KWH', rate: 265 },
  { code: 'DAYS', label: 'Хоног', unit: 'NUMBER', rate: 31 },
  { code: 'HOURS', label: 'Цаг', unit: 'NUMBER', rate: 12 },
  { code: 'CAPACITY_RATE', label: 'Чадлын тариф', unit: 'CAPACITY', rate: 15500 },
  { code: 'VAT', label: 'НӨАТ', unit: 'PERCENT', rate: 10 },
];

// СӨХ-ийн хүснэгт: 1-р мөр гарчиг, 2-р мөр баганын нэр
const titleRow = ['1-р орцны цахилгааны төлбөр', ...Array(21).fill(''), 'Өмнөх үлдэгдэл', 'Нийт төлбөр', 'Тоот'];
const columnNames = [
  '№', 'Тоот', 'Заалт 8 сар', 'Заалт 9 сар', 'Зөрүү', 'коэфф', 'квт.цаг', 'Тариф', 'Төлөх1',
  'Хоног', 'Хоногийн квт', 'Цаг', 'Коэф', 'Төг/квт ц', 'Чад.төлбөр', 'Нийлбэр', 'НӨАТ', 'Нийт',
  'төлөв', 'Он сар өдөр', 'Дүн', 'ИЛҮҮ ДУТУУ', 'Өмнөх үлдэгдэл', 'Нийт төлбөр', 'Тоот',
];

/** [тоот, өмнөх заалт, одоогийн заалт, Excel-ийн нийт дүн] */
const cases: [number | string, number | '', number | '', number | null][] = [
  [105, 6541, 6817, 95431.6],
  [106, 3717, 3899, 62929.53],
  [107, 6544, 6713, 58434.57],
  [193, 3926, 4067, 48753.1],
  [195, 7619, 7716, 33539.37],
  // Хэрэглээгүй айл — зөвхөн 0 төлбөр
  [250, 1000, 1000, 0],
  // Заалт бөглөөгүй — алгасах ёстой
  [6, 11539, '', null],
  // Хоёулаа хоосон — хүнгүй байр, зарцуулалт 0
  [7, '', '', 0],
];

const dataRows = cases.map(([flat, prev, current], i) => {
  const row = Array(25).fill('');
  row[0] = i + 1;
  row[1] = flat;
  row[2] = prev;
  row[3] = current;
  return row;
});

const sheet = XLSX.utils.aoa_to_sheet([titleRow, columnNames, ...dataRows]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet, '9 сар  1 орц ');
const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

// ── Браузер дээрх readSheets() яг үүнийг хийдэг ────────────────────────────
const back = XLSX.read(buffer, { cellDates: true });
const grid = XLSX.utils.sheet_to_json<unknown[]>(back.Sheets['9 сар  1 орц '], {
  header: 1,
  defval: '',
  blankrows: false,
});
const { rows, headerRow } = gridToRows(grid);
console.log(`Толгой олдсон мөр: ${headerRow} (хүлээсэн 2) ${headerRow === 2 ? '✅' : '❌'}`);

const columns = detectElectricityColumns(Object.keys(rows[0] ?? {}));
console.log(`Багана: тоот=${columns.flat} · өмнөх=${columns.prev} · одоогийн=${columns.current}\n`);

const flats: { flatNumber: number; name: string | null }[] = [];
for (let i = 1; i <= 999; i++) flats.push({ flatNumber: i, name: null });
const parsed = parseElectricityInvoices(rows, createFlatResolver(flats));

let ok = 0;
let expected = 0;
for (const [flat, , , want] of cases) {
  if (want === null) continue;
  expected++;
  const row = parsed.rows.find((r) => r.flatNumber === flat);
  if (!row) {
    console.log(`❌ тоот ${flat} уншигдсангүй`);
    continue;
  }
  const bill = calculateElectricity(row, TARIFFS);
  const pass = Math.abs(bill.total - want) < 0.02;
  if (pass) ok++;
  console.log(
    `${pass ? '✅' : '❌'} тоот ${String(flat).padStart(4)} | ` +
      `${String(row.prev).padStart(6)} → ${String(row.current).padStart(6)} | ` +
      `${String(bill.billedKwh).padStart(8)} кВт·ц | ` +
      `систем ${bill.total.toFixed(2).padStart(10)}₮  excel ${want.toFixed(2).padStart(10)}₮`,
  );
}

console.log('\nАлгасагдсан мөр:');
for (const s of parsed.skipped) console.log(`  мөр ${s.rowIndex}: ${s.reason} — «${s.raw}»`);

// ── Заалт буурсан үед татгалзах ёстой ──────────────────────────────────────
let guarded = false;
try {
  calculateElectricity({ prev: 500, current: 100 }, TARIFFS);
} catch (error) {
  guarded = error instanceof ElectricityError;
}
console.log(`\n${guarded ? '✅' : '❌'} Заалт буурахад татгалзаж байна`);

console.log('\nЗадаргаа (тоот 105):');
const sample = calculateElectricity({ prev: 6541, current: 6817 }, TARIFFS);
for (const line of sample.lines) {
  console.log(`  ${line.label.padEnd(24)} ${String(line.rate).padStart(7)} × ${String(line.qty).padStart(10)} = ${line.amount.toFixed(2).padStart(11)}₮`);
}

console.log(`\n${ok}/${expected} айлын дүн Excel-тэй таарлаа`);
