import type { FlatResolver } from '@/lib/matching/parse-water-invoices';

/**
 * «Тоот» нүдний агуулгаас тоотыг таних.
 *
 * Хоёр арга:
 *  1. Тоо — «193», «115 тоот» → 193, 115
 *  2. НЭР — «amo sport», «өв соёл», «дэлгүүр». СӨХ-ийн хүснэгтэд арилжааны
 *     хэсгүүд тоогоор биш нэрээрээ бичигдсэн байдаг. Тэднийг flats
 *     хүснэгтийн owner_name-тай тулгаж танина.
 *
 * Нэр тулгах нь ЗӨӨЛӨН: том/жижиг үсэг, зай, дүрсийг үл хэрэгсэнэ. Мөн
 * хэсэгчилсэн тохирлыг зөвшөөрнө («amo sport» ⊂ «Аму спорт лаб» биш тул
 * латин/кирилл хосыг ч шалгана).
 */

/** Харьцуулахад бэлтгэх: жижиг үсэг, зөвхөн үсэг ба тоо */
const key = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Латин үсгийг кирилл рүү — «amo sport» ↔ «аму спорт» танихад */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и',
  j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р',
  s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
};

const toCyrillic = (value: string) =>
  [...value].map((ch) => LATIN_TO_CYRILLIC[ch] ?? ch).join('');

export interface NamedFlat {
  flatNumber: number;
  /** flats.owner_name — оршин суугчид харагддаг нэр */
  name: string | null;
  /** flats.excel_label — Excel дээр бичигддэг нэр. Эрхэм нь ЭНЭ. */
  excelLabel?: string | null;
}

/**
 * Resolver үүсгэнэ.
 *
 * @param flats  flats хүснэгтийн бүх мөр (тоот + owner_name)
 */
export function createFlatResolver(flats: readonly NamedFlat[]): FlatResolver {
  // Нэрээр хайх индекс — кирилл болгосон хэлбэрээр.
  // excel_label нь owner_name-аас ЭРХЭМ: Excel дээрх жинхэнэ бичиглэл тэр.
  const byName = new Map<string, number>();
  for (const flat of flats) {
    const k = flat.name ? toCyrillic(key(flat.name)) : '';
    if (k && !byName.has(k)) byName.set(k, flat.flatNumber);
  }
  for (const flat of flats) {
    const k = flat.excelLabel ? toCyrillic(key(flat.excelLabel)) : '';
    if (k) byName.set(k, flat.flatNumber);
  }

  return (raw: string): number | null => {
    const text = raw.trim();
    if (!text) return null;

    // 1. Тоо — зөвхөн цифр ба зай/тоот гэсэн үг байвал
    const digits = text.replace(/\D/g, '');
    if (digits) {
      const n = Number.parseInt(digits, 10);
      if (Number.isInteger(n) && n > 0) return n;
    }

    // 2. Нэр — яг тохирол, дараа нь хэсэгчилсэн
    const k = toCyrillic(key(text));
    if (!k) return null;

    const exact = byName.get(k);
    if (exact !== undefined) return exact;

    // Хэсэгчилсэн тохирол — ЗӨВХӨН нэг л тохирол олдвол. Хоёр ба түүнээс
    // дээш тохирвол мөнгө буруу айлд оногдох эрсдэлтэй тул татгалзана.
    const matches = [...byName.entries()].filter(
      ([name]) => name.length >= 4 && (name.includes(k) || k.includes(name)),
    );
    return matches.length === 1 ? matches[0][1] : null;
  };
}
