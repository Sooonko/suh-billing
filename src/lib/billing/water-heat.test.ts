import * as XLSX from 'xlsx';
import { calculateWaterHeat, type TariffRow } from './water-heat';
import { createFlatResolver } from './flat-resolver';
import { resolveTariffs, type TariffWithEntrance } from './resolve-tariffs';
import { detectWaterColumns, parseWaterInvoices } from '@/lib/matching/parse-water-invoices';
import { gridToRows } from '@/lib/read-sheet';

/**
 * Ус дулааны БҮХЭЛ гинжийн тест — СӨХ-ийн жинхэнэ хүснэгтээр.
 *
 *   2 мөрт толгой → толгой таних → багана таних → задлах → бодох
 *
 * Системийн бодсон тоог Excel дээр гараар бодсон тоотой ТУЛГАНА.
 *
 * Ажиллуулах: npm run test:water
 */

// СӨХ-ийн хүснэгтийн бүтэц яг хэвээрээ: дээр бүлгийн мөр, доор баганын нэр
const groupRow = [
  '', 'Заалт', '', '', '', '', '', '',
  'Цэвэр ус', '', 'Бохир ус', '',
  'Тогтмол зардал ААН', '',
  'Төлбөр', '', '', '', '', '', '', '', '', 'Тоот',
];

const columnNames = [
  'Тоот',
  'Халуун ус 8 сар заалт', 'Халуун ус 9 сар заалт',
  'Хүйтэн ус 8 сар заалт', 'Хүйтэн ус 9 сар заалт',
  'Халуун ус зөрүү', 'Хүйтэн ус зөрүү', 'Нийт',
  'Цэвэр ус тариф ААН', 'Нийт цэвэр усны төлбөр',
  'Бохир ус тариф ААН', 'Нийт бохир усны төлбөр',
  'Усны суурь хураамж', 'Ус халаасны төлбөр',
  'Төлбөр', 'НӨАТ 10%', 'Төлбөр',
  'Төлбөр төлсөн эсэх', 'Төлсөн сар өдөр', 'Төлсөн дүн',
  'Төлсөн айлуудын үлдэгдэл төлөх д', 'өмнө сарууддын үлдэгдэл',
  'Нийт төлбөр', 'Тоот',
];

/** Excel дээр бодогдсон утгууд — эдгээртэй тулгана */
const dataRows = [
  // тоот 193 — таны өгсөн жишээ
  [193, 111, 113, 126, 130, 2, 4, 6, 3500, 21000, 3200, 19200, 3000, 2637, 45837, 4583.7, 50420.7, '', '', '', 50420.7, '', 50420.7, 193],
  // хэрэглээгүй айл — зөвхөн тогтмол зардал + НӨАТ
  [108, 200, 200, 340, 340, 0, 0, 0, 3500, 0, 3200, 0, 3000, 2637, 5637, 563.7, 6200.7, '', '', '', 6200.7, '', 6200.7, 108],
  // таслалтай заалт
  [236, 45.5, 48.2, 60, 63.5, 2.7, 3.5, 6.2, 3500, 21700, 3200, 19840, 3000, 2637, 47177, 4717.7, 51894.7, '', '', '', 51894.7, '', 51894.7, 236],
  // Excel-ийн "нийт" мөр — алгасагдах ёстой
  ['НИЙТ', '', '', '', '', '', '', 12.2, '', 42700, '', 39040, '', '', 98651, 9865.1, 108516.1, '', '', '', '', '', '', ''],
];

const sheet = XLSX.utils.aoa_to_sheet([groupRow, columnNames, ...dataRows]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

// ── Браузер дээрх readSheetRows() яг үүнийг хийдэг ──────────────────────────
const back = XLSX.read(buffer, { cellDates: true });
const grid = XLSX.utils.sheet_to_json<unknown[]>(back.Sheets.Sheet1, {
  header: 1,
  defval: '',
  blankrows: false,
});
const { rows, headerRow } = gridToRows(grid);
console.log(`Толгой олдсон мөр: ${headerRow} (хүлээсэн 2) ${headerRow === 2 ? '✅' : '❌'}\n`);

// ── Багана таних ────────────────────────────────────────────────────────────
const columns = detectWaterColumns(Object.keys(rows[0] ?? {}));
console.log('Олдсон багана:');
console.log(`  тоот          : ${columns.flat}`);
console.log(`  халуун өмнөх  : ${columns.hotPrev}`);
console.log(`  халуун одоо   : ${columns.hotCurrent}`);
console.log(`  хүйтэн өмнөх  : ${columns.coldPrev}`);
console.log(`  хүйтэн одоо   : ${columns.coldCurrent}\n`);

// ── Задлах ба бодох ─────────────────────────────────────────────────────────
const validFlats = new Set<number>([6, 7, 901, 902, 903]);
for (let i = 105; i <= 308; i++) validFlats.add(i);

const TARIFFS: TariffRow[] = [
  { code: 'CLEAN_WATER', label: 'Цэвэр ус тариф', unit: 'PER_M3', rate: 3500 },
  { code: 'WASTE_WATER', label: 'Бохир ус тариф', unit: 'PER_M3', rate: 3200 },
  { code: 'BASE_FEE', label: 'Усны суурь хураамж', unit: 'FIXED', rate: 3000 },
  { code: 'HEATING', label: 'Ус халаалсны төлбөр', unit: 'FIXED', rate: 2637 },
  { code: 'VAT', label: 'НӨАТ', unit: 'PERCENT', rate: 10 },
];

const resolveFlat = createFlatResolver([
  ...[...validFlats].map((flatNumber) => ({ flatNumber, name: null })),
  { flatNumber: 901, name: 'Аму спорт лаб' },
  { flatNumber: 902, name: 'Өв соёл' },
]);
const parsed = parseWaterInvoices(rows, resolveFlat);

// Excel өөрөө бодсон эцсийн дүн — «Төлбөр_2» (НӨАТ нэмсний дараах)
const excelTotals = new Map<number, number>(
  dataRows
    .filter((r) => typeof r[0] === 'number')
    .map((r) => [r[0] as number, r[16] as number]),
);

let ok = 0;
for (const row of parsed.rows) {
  const bill = calculateWaterHeat(row, TARIFFS);
  const excel = excelTotals.get(row.flatNumber);
  const match = excel !== undefined && Math.abs(bill.total - excel) < 0.005;
  if (match) ok++;

  console.log(
    `${match ? '✅' : '❌'} тоот ${String(row.flatNumber).padStart(3)} | ` +
      `халуун ${String(bill.hotUsage).padStart(5)} м³ · ` +
      `хүйтэн ${String(bill.coldUsage).padStart(5)} м³ · нийт ${String(bill.totalUsage).padStart(5)} м³ | ` +
      `систем ${bill.total.toFixed(2).padStart(10)}₮  excel ${(excel ?? 0).toFixed(2).padStart(10)}₮`,
  );
  if (row.flatNumber === 193) {
    console.log('     задаргаа:');
    for (const line of bill.lines) {
      console.log(`       ${line.label.padEnd(22)} ${String(line.rate).padStart(7)} × ${String(line.qty).padStart(8)} = ${line.amount.toFixed(2).padStart(10)}₮`);
    }
    console.log(`       ${'НӨАТ-гүй дүн'.padEnd(22)} ${' '.repeat(18)}= ${bill.subtotal.toFixed(2).padStart(10)}₮`);
  }
}

console.log('\nАлгасагдсан мөр:');
for (const s of parsed.skipped) console.log(`  мөр ${s.rowIndex}: ${s.reason} («${s.raw}»)`);

console.log(`\n${ok}/${parsed.rows.length} айлын дүн Excel-тэй таарлаа`);

// ── Тоот таних: тоо ба НЭР ──────────────────────────────────────────────────
// СӨХ-ийн хүснэгтэд арилжааны хэсгүүд тоогоор биш нэрээрээ бичигддэг.
console.log('\nТоот таних:');

const namedResolver = createFlatResolver([
  { flatNumber: 193, name: 'Бат', excelLabel: null },
  { flatNumber: 901, name: 'Аму спорт лаб', excelLabel: 'amo sport' },
  { flatNumber: 902, name: 'Өв соёл', excelLabel: null },
  { flatNumber: 903, name: 'Студи', excelLabel: null },
]);

const resolverCases: [string, number | null][] = [
  ['193', 193],
  ['115 тоот', 115],
  ['amo sport', 901],        // excel_label-аар
  ['AMO SPORT', 901],        // том үсэг
  ['өв соёл', 902],          // owner_name-аар
  ['Өв  соёл', 902],         // зай илүү
  ['студи', 903],
  ['дэлгүүр', null],         // бүртгэлгүй — алгасах ёстой
  ['НИЙТ', null],            // Excel-ийн нийлбэр мөр
  ['', null],
];

let resolverOk = 0;
for (const [input, want] of resolverCases) {
  const got = namedResolver(input);
  const pass = got === want;
  if (pass) resolverOk++;
  console.log(
    `  ${pass ? '✅' : '❌'} «${input}»`.padEnd(24) +
      ` → ${String(got ?? '—').padStart(4)} (хүлээсэн ${String(want ?? '—')})`,
  );
}
console.log(`\n${resolverOk}/${resolverCases.length} тоот таних тохиолдол зөв`);

// ── Орц тусгайлсан тариф ───────────────────────────────────────────────────
// 1 орц 9 сар хүртэл ус халаалтын төлбөр аваагүй. 10 сараас ерөнхий тариф
// автоматаар үйлчилнэ. Орцын мөр нь ерөнхийг ДАРНА.
console.log('\nОрц тусгайлсан тариф:');

const withEntrance: TariffWithEntrance[] = [
  { code: 'CLEAN_WATER', label: 'Цэвэр ус', unit: 'PER_M3', rate: 3500, entrance: null, sortOrder: 1 },
  { code: 'WASTE_WATER', label: 'Бохир ус', unit: 'PER_M3', rate: 3200, entrance: null, sortOrder: 2 },
  { code: 'BASE_FEE', label: 'Суурь хураамж', unit: 'FIXED', rate: 3000, entrance: null, sortOrder: 3 },
  { code: 'HEATING', label: 'Ус халаалт', unit: 'FIXED', rate: 2637, entrance: null, sortOrder: 4 },
  { code: 'VAT', label: 'НӨАТ', unit: 'PERCENT', rate: 10, entrance: null, sortOrder: 5 },
  // 9 сар хүртэл хүчинтэй байсан 1 орцын дарах мөр
  { code: 'HEATING', label: 'Ус халаалт (1 орц)', unit: 'FIXED', rate: 0, entrance: 1, sortOrder: 4 },
];

/** Зөвхөн 9 сард хүчинтэй мөрүүд — 1 орцын дарах мөр хамт */
const september = withEntrance;
/** 10 сард 1 орцын мөрийн хугацаа дуусна — DB шүүлт түүнийг оруулахгүй */
const october = withEntrance.filter((t) => t.entrance === null);

const readings = { hotPrev: 73, hotCurrent: 79, coldPrev: 241, coldCurrent: 246 }; // 11 м³

const scenarios: [string, TariffWithEntrance[], number | null, number][] = [
  ['9 сар · 1 орц  (халаалтгүй)', september, 1, 84370],
  ['9 сар · 2 орц  (халаалттай)', september, 2, 87270.7],
  ['10 сар · 1 орц (халаалттай)', october, 1, 87270.7],
  ['10 сар · 2 орц (халаалттай)', october, 2, 87270.7],
];

let entranceOk = 0;
for (const [name, tariffSet, entrance, want] of scenarios) {
  const bill = calculateWaterHeat(readings, resolveTariffs(tariffSet, entrance));
  const pass = Math.abs(bill.total - want) < 0.005;
  if (pass) entranceOk++;
  const heating = bill.lines.find((l) => l.code === 'HEATING');
  console.log(
    `  ${pass ? '✅' : '❌'} ${name.padEnd(30)} халаалт ${String(heating?.amount ?? '—').padStart(6)}₮ ` +
      `· нийт ${bill.total.toFixed(2).padStart(10)}₮ (хүлээсэн ${want})`,
  );
}
console.log(`\n${entranceOk}/${scenarios.length} орцын тохиолдол зөв`);
