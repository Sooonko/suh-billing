import { matchFlat } from './parse-flat';

// Жинхэнэ байрны тоотууд: 6, 7 · 105–308 · 901–903 (нэрт хэсгүүд)
const flats = new Set<number>([6, 7, 901, 902, 903]);
for (let i = 105; i <= 308; i++) flats.add(i);

const rows: [string, number | null][] = [
  ['EB -2-Р ОРЦ 276 ТООТ-САРАНЧИМЭГ БЯМБА', 276],
  ['184ТООТУС-БИНДЭРЪЯА ПҮРЭВСҮРЭН', 184],
  ['2-236TOOT 6N SAR US-ИЧИННОРОВ ЭНХЖИН', 236],
  ['2-ОРЦ 213 TOOT 6,7 САРЫН УСНЫ ТӨЛБӨР-БАТСҮРЭН МИНЖ', 213],
  ['2R ORTS 289TOOT 7SAR-ЖАМСРАН ГАНЦОЛМОН', 289],
  ['192 TOOT УС ДУЛААН-НАЦАГДОРЖ СЭРГЭЛЭН', 192],
  ['2-257 US-ЖАРГАЛСАЙХАН ГАНБОЛОР', 257],
  ['1-120 TOOT US DULAAN-ОЧИРЖАНЦАН МӨНГӨНЦАГААН', 120],
  ['156 TOOT US DULAAN 7 SAR-ЭРХЭМБАЯР ЗОЛЗАЯА', 156],
  ['292-ГАНХУЯГ ШИНЭБАЯР', 292],
  ['2-236TOOT 7-SAR US-ИЧИННОРОВ ЭНХЖИН', 236],
  ['7 SAR 2-274 TOOT US, DULAAN', 274],
  ['323р байр 1 орц 127 тоот усны үнэ', 127],
  ['USAND', null],
  ['ХҮСЛЭН ДЭЛГҮҮР 95330777', null],
  ['12-2-278 DULAAN-БЯМБАА АНХЗАЯА', 278],
  ['2-233 US DULAAN', 233],
  ['2-Р ОРЦ 290TOOT 8CAP', 290],
  ['2-Р ОРЦ265 ТООТ. УС ДУЛААН 8 САР-БААТАР ЭНХБОЛД', 265],
  ['210 TOOT', 210],
];

let ok = 0;
for (const [desc, want] of rows) {
  const r = matchFlat(desc, flats);
  const pass = r.flatNumber === want;
  if (pass) ok++;
  console.log(
    `${pass ? '✅' : '❌'} ${String(r.flatNumber ?? '—').padStart(4)} (${r.confidence.padEnd(6)}) ` +
      `| ${desc.slice(0, 48).padEnd(48)} | ${r.reason ?? ''}`,
  );
}
console.log(`\n${ok}/${rows.length} зөв — ${Math.round((ok / rows.length) * 100)}%`);
