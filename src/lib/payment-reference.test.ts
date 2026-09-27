import { buildPaymentReference } from './payment-reference';
import { detectCategoryHint } from './matching/detect-category';
import { matchFlat } from './matching/parse-flat';
import { CATEGORIES, type BillCategory } from './types';

/**
 * ГЭРЭЭНИЙ ТЕСТ: оршин суугчид «ингэж бич» гэж өгсөн утгыг манай
 * задлагч ЗААВАЛ зөв уншина.
 *
 * Хоёр тал зөрвөл оршин суугч зааврын дагуу бичсэн ч төлбөр нь гар
 * шалгалт руу унана — хэрэглэгчийн нүдэнд «систем ажиллахгүй байна».
 *
 * Ажиллуулах: npm run test:reference
 */

const flats = new Set<number>([6, 7, 901, 902, 903, 904]);
for (let i = 105; i <= 308; i++) flats.add(i);

const months = [null, '2026-01', '2026-08', '2026-09', '2026-12'];
const sampleFlats = [6, 7, 105, 197, 236, 308, 901, 904];

let ok = 0;
let total = 0;
const failures: string[] = [];

for (const flat of sampleFlats) {
  for (const { key } of CATEGORIES) {
    for (const month of months) {
      total++;
      const reference = buildPaymentReference(flat, key as BillCategory, month);

      // 1. Тоот зөв уншигдах ёстой
      const match = matchFlat(reference, flats);
      const flatOk = match.flatNumber === flat;

      // 2. Ангилал зөв таагдах ёстой. detectCategoryHint нь БАГЦ дээр
      //    ажилладаг тул нэг утгыг 5 удаа өгч босгыг нь хангуулна.
      const hint = detectCategoryHint(Array.from({ length: 5 }, () => reference));
      const catOk = hint.dominant === key;

      if (flatOk && catOk) ok++;
      else
        failures.push(
          `  ❌ «${reference}» → тоот ${match.flatNumber ?? '—'}${flatOk ? '' : ` (хүлээсэн ${flat})`}` +
            `${catOk ? '' : ` · ангилал ${hint.dominant ?? '—'} (хүлээсэн ${key})`}`,
        );
    }
  }
}

console.log('Жишээ утгууд:');
for (const { key, label } of CATEGORIES) {
  console.log(`  ${label.padEnd(12)} «${buildPaymentReference(197, key as BillCategory, '2026-09')}»`);
}
console.log(`  саргүй       «${buildPaymentReference(197, 'WATER_HEAT', null)}»`);

console.log(`\n${failures.length ? failures.join('\n') + '\n' : ''}${ok}/${total} утга зөв уншигдлаа`);
