import { gridToRows } from '@/lib/read-sheet';
import {
  extractStatementTransfers,
  markDuplicateTransfers,
  parseTransferLedger,
  recipientFromDescription,
  recipientFromName,
  transferKey,
} from './transfers';

/**
 * Улсын байгууллагын шилжүүлэг — танилт, Excel задлах, давхардал.
 *
 * Ажиллуулах: npm run test:transfers
 */

let ok = 0;
let total = 0;
function check(name: string, pass: boolean, detail = '') {
  total++;
  if (pass) ok++;
  console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log('\nГүйлгээний утгаас код таних:');
check('цахилгаан 4044820', recipientFromDescription('4044820 ПИЙС СӨХ 9 САР') === 'UBCTS');
check('ус суваг 25010490', recipientFromDescription('25010490 ус') === 'USUG');
check('дулаан 11619', recipientFromDescription('УЛААНБААТАР ДУЛААНЫ СҮЛЖЭЭ ТӨХК 11619') === 'UB_HEAT');
check('урт тоон дотор 11619 таахгүй', recipientFromDescription('Данс 2116190 шилжүүлэг') === null);
check('шимтгэл — код байхгүй', recipientFromDescription('Гүйлгээний шимтгэл') === null);

console.log('\n«Хаана» баганаас таних:');
check('УБЦТС', recipientFromName('УБЦТС') === 'UBCTS');
check('Ус сувгийн удирдах газар (эгшиг гээгдсэн)', recipientFromName('Ус сувгийн удирдах газар ') === 'USUG');
check('УБ дулааны сүлжээ', recipientFromName('УБ дулааны сүлжээ') === 'UB_HEAT');

console.log('\n«Шилжүүлсэн баримт» Excel:');
const ledger = parseTransferLedger([
  ['№', 'Огноо', 'Хаана ', 'Мөнгөн дүн', '', '№', 'Огноо', 'Хаана ', 'Мөнгөн дүн', '', 'Орхоны шугуй ХХК-ийн ӨРӨНД'],
  [1, '2025-08-28', 'УБЦТС', 493135, '', 1, '2025-08-28', 'Ус сувгийн удирдах газар', 602657, '', '№', 'Огноо', 'Хаана ', 'Мөнгөн дүн'],
  [2, '2025-08-29', 'УБЦТС', 1310000, '', 2, '', 'Ус сувгийн удирдах газар', '', '', 1, '2025-09-19', 'УБ дулааны сүлжээ', 5000000],
  ['', '', 'Цахилгаан тушаасан нийт мөнгө:', 1803135, '', '', '', '', '', '', '', '', 'Нийт:', 5000000],
]);
check('3 блок олсон', ledger.blocks === 3, String(ledger.blocks));
check('4 шилжүүлэг', ledger.transfers.length === 4, String(ledger.transfers.length));
check('нийлбэр, бөглөөгүй мөр чимээгүй алгасна', ledger.skipped.length === 0, JSON.stringify(ledger.skipped));
const orkhon = ledger.transfers.find((t) => t.recipient === 'UB_HEAT');
check('блокийн гарчиг тэмдэглэл болно', orkhon?.note === 'Орхоны шугуй ХХК-ийн ӨРӨНД', String(orkhon?.note));
check(
  'энгийн блокт тэмдэглэлгүй',
  ledger.transfers.filter((t) => t.recipient !== 'UB_HEAT').every((t) => t.note === null),
);

console.log('\nДавхардал (тоогоор):');
const t = { recipient: 'UB_HEAT' as const, transferDate: '2025-12-25', amount: 900000 };
check('DB-д 1, файлд 2 → нэг нь шинэ', JSON.stringify(markDuplicateTransfers([t, t], [transferKey(t)])) === '[true,false]');
check('DB-д 2, файлд 2 → хоёулаа давхардсан', JSON.stringify(markDuplicateTransfers([t, t], [transferKey(t), transferKey(t)])) === '[true,true]');
check('өөр дүн → шинэ', markDuplicateTransfers([{ ...t, amount: 900001 }], [transferKey(t)])[0] === false);

console.log('\nБанкны хуулгын зарлага:');
const { rows } = gridToRows([
  ['Гүйлгээний огноо', 'Эхний үлдэгдэл', 'Зарлага', 'Орлого', 'Эцсийн үлдэгдэл', 'Гүйлгээний утга', 'Харьцсан данс'],
  ['2026-10-15T12:34:44', 1000000, '', 35000, 1035000, '240 ТООТ СӨХ', ''],
  ['2026-10-16T09:00:00', 1035000, 500000, '', 535000, '4044820 ПИЙС 9 сар', ''],
  ['2026-10-16T09:00:01', 535000, 100, '', 534900, 'Гүйлгээний шимтгэл', ''],
  ['2026-10-17T23:50:00', 534900, 300000, '', 234900, 'ДУЛААН 11619', ''],
]);
const found = extractStatementTransfers(rows);
check('зөвхөн кодтой 2 зарлага', found.length === 2, String(found.length));
check('орлого, шимтгэл ороогүй', found.every((f) => f.amount === 500000 || f.amount === 300000));
check('шөнө дүл хуанлийн өдрөө хадгална', found[1]?.transferDate === '2026-10-17', String(found[1]?.transferDate));

console.log(`\n${ok}/${total} зөв`);
if (ok !== total) process.exitCode = 1;
