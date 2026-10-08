/**
 * Оршин суугч аль зарлалыг ХАРСАН бэ — хөтчийн localStorage-д.
 *
 * ЯАГААД localStorage: оршин суугчийн тал нэвтрэлтгүй тул серверт «хэн
 * юу уншсан» гэдгийг хадгалах газар байхгүй. Төхөөрөмж бүр өөрийн
 * тэмдэглэлтэй — утсан дээр уншсан нь компьютер дээр «шинэ» хэвээр байж
 * болно. Энэ нь хүлээн зөвшөөрөх хязгаарлалт.
 *
 * «Шинэ» = ХАРААГҮЙ бөгөөд сүүлийн 30 хоногт нийтлэгдсэн. Хугацааны
 * хязгаар нь анх орж буй хүнд хагас жилийн өмнөх 20 зарлалыг «шинэ» гэж
 * харуулахгүйн тулд.
 *
 * Хадгалах, унших бүх үйлдэл try/catch-тэй — хувийн горим (private mode),
 * хориглосон хөтөч дээр алдаа шидэхгүй, зүгээр л «шинэ» тэмдэг гарахгүй.
 */

const KEY = 'soh:news-seen:v1';
const EVENT = 'soh:news-seen';
/** Хадгалах дээд тоо — localStorage хязгааргүй өсөхгүй */
const MAX_IDS = 300;

export const NEW_WINDOW_DAYS = 30;

export interface NewsStamp {
  id: string;
  published_at: string;
}

/**
 * Хадгалсан ТЕКСТ — `useSyncExternalStore`-ийн snapshot. Текст нь өөрчлөгдөөгүй
 * бол ижил утга буцаадаг тул React дахин зурахгүй (Set бол үргэлж шинэ объект).
 */
export function readSeenRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function parseSeen(raw: string): Set<string> {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function readSeen(): Set<string> {
  return parseSeen(readSeenRaw());
}

export function markSeen(ids: string[]): void {
  try {
    const seen = readSeen();
    const before = seen.size;
    for (const id of ids) seen.add(id);
    if (seen.size === before) return;
    // Хамгийн сүүлд нэмсэн нь Set-ийн төгсгөлд — хуучныг нь эхнээс тайрна
    const list = [...seen].slice(-MAX_IDS);
    window.localStorage.setItem(KEY, JSON.stringify(list));
    // Ижил цонхны бусад хэсэг (цэсний тэмдэг) шинэчлэгдэнэ
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* хадгалах боломжгүй — чимээгүй өнгөрнө */
  }
}

/** Өөр таб дээр уншсан ч энэ таб шинэчлэгдэнэ (`storage` үйл явдал) */
export function subscribeSeen(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/** Сүүлийн 30 хоногт нийтлэгдсэн үү */
export function isRecent(publishedAt: string, now: number): boolean {
  const time = new Date(publishedAt).getTime();
  return Number.isFinite(time) && now - time < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Уншаагүй, шинэ зарлалууд */
export function unseenOf<T extends NewsStamp>(items: T[], seen: Set<string>, now: number): T[] {
  return items.filter((item) => !seen.has(item.id) && isRecent(item.published_at, now));
}

/**
 * «2 цагийн өмнө», «Өчигдөр», «9 сарын 18».
 *
 * Зөвхөн БРАУЗЕР дээр дуудна — сервер ба хөтчийн цаг зөрвөл React
 * hydration алдаа гаргана. Сервер дээр `shortDate` харуулна.
 */
export function relativeTime(iso: string, now: number): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 1) return 'Дөнгөж сая';
  if (minutes < 60) return `${minutes} минутын өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;

  // Өдрийг хуанлийн өдрөөр тоолно — өчигдөр 23:00 нь «Өчигдөр», 1 өдөр биш
  const startOf = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((startOf(now) - startOf(time)) / 86_400_000);
  if (days <= 1) return 'Өчигдөр';
  if (days < 7) return `${days} өдрийн өмнө`;
  return shortDate(iso, now);
}

/** "2026-09-18T..." → "9 сарын 18". Он өөр бол оныг нэмнэ. */
export function shortDate(iso: string, now?: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${d.getMonth() + 1} сарын ${d.getDate()}`;
  const year = now === undefined ? null : new Date(now).getFullYear();
  return year !== null && year !== d.getFullYear() ? `${d.getFullYear()} оны ${base}` : base;
}
