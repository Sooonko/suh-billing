import { normalize, stripNoise, TOOT } from './normalize';

/**
 * Гүйлгээний утгаас ТООТ таних цөм.
 *
 * Энгийн regex дангаараа хангалтгүй. Учир нь нэг утганд 3 тоо байж болно:
 *   "323р байр 1 орц 127 тоот"  →  323? 1? 127?
 *   "12-2-278 DULAAN"           →  12? 2? 278?
 *
 * Тиймээс 2 үе шаттай ажиллана:
 *   1) НЭР ДЭВШИГЧ цуглуулах — итгэлцлийн зэрэглэлтэйгээр
 *   2) БАТАЛГААЖУУЛАХ       — flats хүснэгтэд байгаа тоотуудтай тулгах
 *
 * Хоёр дахь алхам нь хамгийн чухал: "12-2-278"-аас зөвхөн 278 нь жинхэнэ тоот
 * учир ямар ч таамаглалгүйгээр зөв хариу гарна.
 */

/** Итгэлцлийн зэрэглэл — бага тоо = илүү найдвартай */
export const Tier = {
  /** "…127 ТООТ…" — ТООТ гэдэг үгийн ӨМНӨХ тоо. Хамгийн найдвартай. */
  BeforeToot: 1,
  /** "2-257" · "12-2-278" — зураасаар холбогдсон гинжний СҮҮЛИЙН тоо */
  DashChain: 2,
  /** "292-ГАНХУЯГ" — эхэнд байгаа тоо, араас нь шууд нэр */
  LeadingBeforeName: 3,
  /** Бусад тусдаа зогсох тоо */
  Loose: 4,
} as const;
export type Tier = (typeof Tier)[keyof typeof Tier];

export interface FlatCandidate {
  flatNumber: number;
  tier: Tier;
}

export type Confidence = 'HIGH' | 'MEDIUM' | 'NONE';

export interface FlatMatchResult {
  /** Эцсийн шийдвэр. null бол гар шалгалт руу явна. */
  flatNumber: number | null;
  confidence: Confidence;
  /** flats хүснэгтэд ОЛДСОН бүх нэр дэвшигч (2+ бол тодорхойгүй) */
  candidates: number[];
  /** Яагаад автоматаар шийдэж чадаагүй бэ — админд харуулна */
  reason?: string;
  /** Дибаг: дуут үг хассаны дараах текст */
  cleaned: string;
}

const RE_BEFORE_TOOT = new RegExp(`(\\d{1,4})\\s*(?:${TOOT})`, 'g');
const RE_DASH_CHAIN = /\d{1,4}(?:\s*-\s*\d{1,4})+/g;
const RE_LEADING_NAME = /(?:^|\s)(\d{1,4})\s*-\s*[А-ЯӨҮЁ]{3,}/g;
const RE_ANY_NUMBER = /\d{1,4}/g;

/**
 * Утгаас бүх боломжит тоотыг зэрэглэлтэйгээр цуглуулна.
 * Баталгаажуулалт хийхгүй — зөвхөн нэр дэвшүүлнэ.
 */
export function collectCandidates(description: string): {
  candidates: FlatCandidate[];
  cleaned: string;
} {
  const cleaned = stripNoise(normalize(description));
  const seen = new Map<number, Tier>();

  const add = (value: string | number, tier: Tier) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return;
    const existing = seen.get(n);
    // Нэг тоо олон зэрэглэлээр олдвол ХАМГИЙН НАЙДВАРТАЙГ нь үлдээнэ
    if (existing === undefined || tier < existing) seen.set(n, tier);
  };

  // 1-р зэрэглэл: ТООТ гэдэг үгийн өмнөх тоо
  for (const m of cleaned.matchAll(RE_BEFORE_TOOT)) add(m[1], Tier.BeforeToot);

  // 2-р зэрэглэл: зураасан гинжний сүүлийн тоо ("12-2-278" → 278)
  for (const m of cleaned.matchAll(RE_DASH_CHAIN)) {
    const parts = m[0].split('-').map((p) => p.trim());
    add(parts[parts.length - 1], Tier.DashChain);
  }

  // 3-р зэрэглэл: "292-ГАНХУЯГ" — тоо, дараа нь шууд кирилл нэр
  for (const m of cleaned.matchAll(RE_LEADING_NAME)) add(m[1], Tier.LeadingBeforeName);

  // 4-р зэрэглэл: үлдсэн бүх тоо
  for (const m of cleaned.matchAll(RE_ANY_NUMBER)) add(m[0], Tier.Loose);

  const candidates = [...seen.entries()]
    .map(([flatNumber, tier]) => ({ flatNumber, tier }))
    .sort((a, b) => a.tier - b.tier);

  return { candidates, cleaned };
}

/**
 * Нэр дэвшигчдийг жинхэнэ тоотын жагсаалттай тулгаж эцсийн шийдвэр гаргана.
 *
 * @param description  Гүйлгээний утга (түүхийгээр)
 * @param validFlats   flats хүснэгтээс уншсан бүх тоот. Энэ нь ГОЛ түлхүүр —
 *                     үүнгүйгээр автомат таалт огцом мууддаг.
 */
export function matchFlat(description: string, validFlats: ReadonlySet<number>): FlatMatchResult {
  const { candidates, cleaned } = collectCandidates(description);
  const valid = candidates.filter((c) => validFlats.has(c.flatNumber));
  const found = valid.map((c) => c.flatNumber);

  if (valid.length === 0) {
    return {
      flatNumber: null,
      confidence: 'NONE',
      candidates: [],
      reason: candidates.length
        ? `Утгаас олдсон тоо (${candidates.map((c) => c.flatNumber).join(', ')}) бүртгэлтэй тоот биш`
        : 'Утганд тоот олдсонгүй',
      cleaned,
    };
  }

  // Ганцхан тохирол — эргэлзээгүй
  if (valid.length === 1) {
    return {
      flatNumber: valid[0].flatNumber,
      confidence: valid[0].tier <= Tier.DashChain ? 'HIGH' : 'MEDIUM',
      candidates: found,
      cleaned,
    };
  }

  // Олон тохирол. Хэрэв 1-р зэрэглэлд (ТООТ үгийн өмнөх) яг нэг л байвал
  // тэрийг шийднэ — "323р байр 1 орц 127 тоот" төрлийн тохиолдол.
  const topTier = valid[0].tier;
  const top = valid.filter((c) => c.tier === topTier);
  if (top.length === 1 && topTier === Tier.BeforeToot) {
    return { flatNumber: top[0].flatNumber, confidence: 'HIGH', candidates: found, cleaned };
  }

  // Эргэлзээтэй → админ шийднэ
  return {
    flatNumber: null,
    confidence: 'NONE',
    candidates: found,
    reason: `Хэд хэдэн тоот тохирч байна: ${found.join(', ')}`,
    cleaned,
  };
}
