import * as XLSX from 'xlsx';
import { dedupeHash, detectColumns, parseDate, parseStatement } from './parse-statement';

/**
 * Банкны хуулгын задлагчийн тест — гол асуулт: ЗАРЛАГА ялгарч байна уу?
 *
 * Хуулга дээр орлого, зарлага хоёр хамт байдаг. Зарлага (шимтгэл, шилжүүлэг,
 * цалин) нь айлын төлбөр БИШ тул огт бүртгэгдэх ёсгүй.
 *
 * Ажиллуулах: npm run test:statement
 */
const validFlats = new Set<number>([6, 7, 901, 902, 903]);
for (let i = 105; i <= 308; i++) validFlats.add(i);

/** Excel файл бүтээж, браузер уншдагаар буцааж уншина */
function toRows(records: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const back = XLSX.read(buffer, { cellDates: true });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(back.Sheets.Sheet1, { defval: '' });
}

async function run(
  name: string,
  records: Record<string, unknown>[],
  expect: { imported: number; skipped: number },
) {
  const rows = toRows(records);
  const columns = detectColumns(Object.keys(rows[0] ?? {}));
  const result = await parseStatement(rows, validFlats);

  const pass = result.transactions.length === expect.imported && result.skipped.length === expect.skipped;
  console.log(`\n${pass ? '✅' : '❌'} ${name}`);
  console.log(`   Олдсон багана: орлого=${columns.credit ?? '—'} · зарлага=${columns.debit ?? '—'}`);
  console.log(`   Бүртгэх ${result.transactions.length} (хүлээсэн ${expect.imported}) · алгасах ${result.skipped.length} (хүлээсэн ${expect.skipped})`);
  for (const t of result.transactions) {
    console.log(`     ✓ ${String(t.amount).padStart(8)}₮  тоот ${t.flatNumber ?? '—'}  | ${t.description.slice(0, 40)}`);
  }
  for (const s of result.skipped) {
    console.log(`     ✗ ${s.reason.padEnd(20)} | ${s.description.slice(0, 40)}`);
  }
  return pass;
}

async function main() {
  const results: boolean[] = [];

// ── 1. Хамгийн түгээмэл: Орлого / Зарлага тусдаа багана ────────────────────
  results.push(
    await run(
    'Орлого / Зарлага тусдаа багана',
    [
      { 'Гүйлгээний огноо': '2026-09-01', Орлого: 44239, Зарлага: '', 'Гүйлгээний утга': '108 ТООТ УС', 'Эцсийн үлдэгдэл': 44239 },
      { 'Гүйлгээний огноо': '2026-09-02', Орлого: '', Зарлага: 500, 'Гүйлгээний утга': 'ШИМТГЭЛ', 'Эцсийн үлдэгдэл': 43739 },
      { 'Гүйлгээний огноо': '2026-09-03', Орлого: '', Зарлага: 2000000, 'Гүйлгээний утга': 'ЦАЛИН ШИЛЖҮҮЛЭГ', 'Эцсийн үлдэгдэл': 0 },
      { 'Гүйлгээний огноо': '2026-09-04', Орлого: 33370, Зарлага: '', 'Гүйлгээний утга': '2-236TOOT 9SAR US', 'Эцсийн үлдэгдэл': 33370 },
    ],
    { imported: 2, skipped: 2 },
    ),
  );

// ── 2. Дебит / Кредит гэж нэрлэсэн банк ────────────────────────────────────
  results.push(
    await run(
    'Дебит / Кредит нэршил',
    [
      { Огноо: '2026-09-01', Кредит: 25000, Дебит: '', 'Гүйлгээний утга': '156 ТООТ СӨХ', Үлдэгдэл: 25000 },
      { Огноо: '2026-09-02', Кредит: '', Дебит: 1200, 'Гүйлгээний утга': 'ГҮЙЛГЭЭНИЙ ШИМТГЭЛ', Үлдэгдэл: 23800 },
    ],
    { imported: 1, skipped: 1 },
    ),
  );

// ── 3. ЭРСДЭЛТЭЙ: нэг «Дүн» багана, зарлага нь СӨРӨГ тоо ───────────────────
  results.push(
    await run(
    'Нэг «Гүйлгээний дүн» багана (сөрөг = зарлага)',
    [
      { Огноо: '2026-09-01', 'Гүйлгээний дүн': 44239, 'Гүйлгээний утга': '108 ТООТ УС', Үлдэгдэл: 44239 },
      { Огноо: '2026-09-02', 'Гүйлгээний дүн': -500, 'Гүйлгээний утга': 'ШИМТГЭЛ', Үлдэгдэл: 43739 },
    ],
    { imported: 1, skipped: 1 },
    ),
  );

  console.log(`\n${results.filter(Boolean).length}/${results.length} тохиолдол зөв`);
}

main();

/**
 * ── Давхардлын хамгаалалт ─────────────────────────────────────────────────
 *
 * dedupe_hash = sha256(огноо | дүн | утга | эцсийн үлдэгдэл), багана дээр
 * UNIQUE индекс. Нэг хуулгыг хэдэн ч удаа оруулсан давхардахгүй.
 *
 * ⚠️ Яагаад УТГЫГ ч оруулдаг вэ: зөвхөн огноо + дүнгээр шалгавал нэг өдөр
 * ижил дүн төлсөн ХОЁР ӨӨР АЙЛЫГ давхардал гэж андуурч, нэгийг нь хаях
 * байсан. Тийм тохиолдол СӨХ-д байнга гардаг (ижил тоотын төлбөр).
 */
async function dedupeChecks() {
  const base = { date: '2026-09-15T00:00:00.000Z', amount: 50420.7, description: '193 ТООТ УС', closingBalance: 1000 };
  const cases: [string, Partial<typeof base>, boolean][] = [
    ['яг ижил мөр (файл дахин оруулсан)', {}, true],
    ['утга зөрсөн — өөр айл, ижил дүн',   { description: '194 ТООТ УС' }, false],
    ['дүн зөрсөн',                        { amount: 50420.71 }, false],
    ['огноо зөрсөн',                      { date: '2026-09-16T00:00:00.000Z' }, false],
    ['утганд зай илүү (trim хийгдэнэ)',   { description: '  193 ТООТ УС  ' }, true],
  ];

  const origin = await dedupeHash(base);
  let ok = 0;
  console.log('\nДавхардал таних:');
  for (const [name, patch, shouldMatch] of cases) {
    const hash = await dedupeHash({ ...base, ...patch });
    const same = hash === origin;
    const pass = same === shouldMatch;
    if (pass) ok++;
    console.log(`  ${pass ? '✅' : '❌'} ${name.padEnd(36)} → ${same ? 'ДАВХАРДСАН' : 'шинэ мөр'}`);
  }
  console.log(`\n${ok}/${cases.length} давхардлын тохиолдол зөв`);
}

/**
 * ── Цагийн бүсээс хамаарах эсэх ───────────────────────────────────────────
 *
 * Банкны хуулга цагийн бүс БИЧДЭГГҮЙ: "2026-09-28T10:45:22". Урьд нь
 * `new Date(...)` нь үүнийг СЕРВЕРИЙН бүсээр уншдаг байсан тул ижил файл
 * компьютер (UTC+8) болон Vercel (UTC) дээр ӨӨР dedupe_hash өгч, давхардлын
 * хамгаалалт чимээгүй нурж байв — 9/28-ны 5 төлбөр дахин «шинэ» гэж
 * харагдаж, илүү төлөлт мэт анхааруулга өгсөн.
 *
 * Энэ тест бүсийг сольж ажиллуулж байгаа тул үр дүн ЯГ ижил гарах ёстой.
 */
async function timezoneChecks() {
  const ZONES = ['UTC', 'Asia/Ulaanbaatar', 'America/New_York', 'Pacific/Kiritimati'];
  const SAMPLES = [
    '2026-09-28T10:45:22',   // бүсгүй огноо-цаг — гол тохиолдол
    '2026-09-28 10:45:22',   // зай тусгаарлагчтай хувилбар
    '2026-09-01',            // зөвхөн огноо
    '2026-09-28T23:50:00',   // шөнө дүл — бүс шилжвэл ӨДӨР нь өөрчлөгдөнө
  ];

  const original = process.env.TZ;
  const results: string[][] = [];
  for (const tz of ZONES) {
    process.env.TZ = tz;
    results.push(SAMPLES.map((s) => parseDate(s) ?? 'null'));
  }
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;

  console.log('\nЦагийн бүсээс хамаарахгүй эсэх:');
  let ok = 0;
  SAMPLES.forEach((sample, i) => {
    const values = new Set(results.map((r) => r[i]));
    const pass = values.size === 1;
    if (pass) ok++;
    console.log(
      `  ${pass ? '✅' : '❌'} ${sample.padEnd(22)} → ${pass ? results[0][i] : [...values].join(' ≠ ')}`,
    );
  });

  // Огноо нь хуулга дээр БИЧИГДСЭН хуанлийн өдрөө хадгалах ёстой
  const dayKept = parseDate('2026-09-28T23:50:00')?.slice(0, 10) === '2026-09-28';
  if (dayKept) ok++;
  console.log(`  ${dayKept ? '✅' : '❌'} шөнө дүлийн гүйлгээ хуанлийн өдрөө хадгална`);

  console.log(`\n${ok}/${SAMPLES.length + 1} цагийн бүсийн тохиолдол зөв`);
}

dedupeChecks().then(timezoneChecks);
