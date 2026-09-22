import * as XLSX from 'xlsx';
import { parseInvoices } from './parse-invoices';

/**
 * Нэхэмжлэлийн задлагчийн тест.
 *
 * Жинхэнэ Excel файл БҮТЭЭЖ, түүнийг браузер яг хэрхэн уншдагаар уншина.
 * Ингэснээр баганын нэр таних, тоог задлах логик хоёулаа шалгагдана.
 *
 * Ажиллуулах: npm run test:invoices
 */
const sheet = XLSX.utils.json_to_sheet([
  // Хэвийн мөр — бүх багана дүүрэн
  { Тоот: 108, 'Өмнөх заалт': 412.5, 'Одоогийн заалт': 431.8, Зарцуулалт: 19.3, Дүн: 44239, Тайлбар: '' },
  // Тоот текстээр, дүн таслалтай, зарцуулалт хоосон → өөрөө бодох ёстой
  { Тоот: '236', 'Өмнөх заалт': 100, 'Одоогийн заалт': 118, Зарцуулалт: '', Дүн: '33,370.00', Тайлбар: 'дахин тооцов' },
  // СӨХ-ийн төлбөр — тоолуургүй тул заалт хоосон
  { Тоот: 901, 'Өмнөх заалт': '', 'Одоогийн заалт': '', Зарцуулалт: '', Дүн: 250000, Тайлбар: 'Аму спорт лаб' },
  // flats хүснэгтэд байхгүй тоот — уншина, гэхдээ isKnownFlat=false
  { Тоот: 999, 'Өмнөх заалт': '', 'Одоогийн заалт': '', Зарцуулалт: '', Дүн: 5000, Тайлбар: 'бүртгэлгүй' },
  // Excel-ийн "нийт" мөр — алгасагдах ёстой
  { Тоот: 'нийт', 'Өмнөх заалт': '', 'Одоогийн заалт': '', Зарцуулалт: '', Дүн: 332609, Тайлбар: 'нийлбэр' },
  // Бүрэн хоосон мөр — чимээгүй алгасагдах ёстой (skipped-д ч орохгүй)
  { Тоот: '', 'Өмнөх заалт': '', 'Одоогийн заалт': '', Зарцуулалт: '', Дүн: '', Тайлбар: '' },
]);

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

// Браузер дээр readSheetRows() яг үүнийг хийдэг
const parsedBook = XLSX.read(buffer, { cellDates: true });
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(parsedBook.Sheets.Sheet1, { defval: '' });

// Жинхэнэ байрны тоотууд: 6, 7 · 105–308 · 901–903
const validFlats = new Set<number>([6, 7, 901, 902, 903]);
for (let i = 105; i <= 308; i++) validFlats.add(i);

const result = parseInvoices(rows, validFlats);

console.log('Олдсон багана:', result.columns);
console.log();

const expected: [number, number | null, number | null, number][] = [
  // тоот, зарцуулалт, — , дүн
  [108, 19.3, null, 44239],
  [236, 18, null, 33370],
  [901, null, null, 250000],
  [999, null, null, 5000],
];

let ok = 0;
for (const [index, row] of result.rows.entries()) {
  const want = expected[index];
  const pass =
    want !== undefined && row.flatNumber === want[0] && row.usageAmount === want[1] && row.billAmount === want[3];
  if (pass) ok++;
  console.log(
    `${pass ? '✅' : '❌'} тоот ${String(row.flatNumber).padStart(4)} ` +
      `${row.isKnownFlat ? '        ' : '(бүртгэлгүй)'} | ` +
      `заалт ${String(row.prevReading ?? '—').padStart(6)} → ${String(row.currentReading ?? '—').padStart(6)} | ` +
      `зарцуулалт ${String(row.usageAmount ?? '—').padStart(6)} | дүн ${String(row.billAmount).padStart(8)}`,
  );
}

console.log('\nАлгасагдсан мөр:');
for (const s of result.skipped) console.log(`  мөр ${s.rowIndex}: ${s.reason} («${s.raw}»)`);

// Хоосон мөр skipped-д ОРОХГҮЙ, "нийт" мөр л орно
const skippedOk = result.skipped.length === 1 && result.skipped[0].raw === 'нийт';
console.log(`\n${ok}/${expected.length} мөр зөв задарсан · хоосон мөрийн зохицуулалт ${skippedOk ? '✅' : '❌'}`);
