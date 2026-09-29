import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Аль хэдийн бүртгэгдсэн гүйлгээг олох.
 *
 * ── Яагаад dedupe_hash дангаараа хангалтгүй вэ ───────────────────────────
 * Hash-д огноо ОРДОГ. Банкны хуулга цагийн бүс бичдэггүй тул нэг файлыг
 * компьютер дээрээс (UTC+8) нэг удаа, Vercel дээрээс (UTC) нэг удаа
 * оруулахад огноо нь 8 цагаар зөрч, hash өөр болж, давхардлын хамгаалалт
 * ЧИМЭЭГҮЙ нурдаг байв.
 *
 * `parseDate` одоо бүсгүй утгыг UTC гэж уншдаг тул ЦААШИД ийм зөрүү
 * гарахгүй. Гэхдээ УРЬД нь орсон мөрүүд хуучин hash-тайгаа үлдсэн — тэднийг
 * барих хоёр дахь шалгуур энэ.
 *
 * ── Түлхүүр: дүн + утга + эцсийн үлдэгдэл ────────────────────────────────
 * Эцсийн үлдэгдэл нь дансны гүйлгээ бүрийн ДАРААЛАЛД эзлэх байр суурь —
 * хоёр өөр гүйлгээ ижил дүн, ижил утга, ижил эцсийн үлдэгдэлтэй байх
 * боломжгүй. Огноо огт оролцохгүй тул цагийн бүсээс хамаарахгүй.
 *
 * Эцсийн үлдэгдэлгүй файлд (зарим банк багана нь байхгүй) энэ шалгуур
 * ажиллахгүй — тэнд hash хэвээрээ хамгаална.
 */

/** Утгыг харьцуулахын өмнө жигдрүүлнэ — зай, том жижиг үсэг мэдрэмжгүй */
function normalize(description: string): string {
  return description.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Дүн + утга + эцсийн үлдэгдлээс бүрдэх, огнооноос ХАМААРАХГҮЙ түлхүүр */
function semanticKey(parts: {
  amount: number;
  description: string;
  closingBalance: number | null;
}): string | null {
  if (parts.closingBalance === null) return null;
  return [parts.amount.toFixed(2), normalize(parts.description), parts.closingBalance.toFixed(2)].join('|');
}

export interface DuplicateCandidate {
  dedupeHash: string;
  amount: number;
  description: string;
  closingBalance: number | null;
}

/**
 * Өгсөн гүйлгээнүүдээс аль нь DB-д АЛЬ ХЭДИЙН байгааг буцаана.
 *
 * Хоёр шалгуурын АЛЬ НЭГ нь таарвал давхардал гэж үзнэ:
 *   1. dedupe_hash яг таарах            (ижил орчноос дахин оруулсан)
 *   2. дүн + утга + эцсийн үлдэгдэл     (өөр цагийн бүсээс оруулсан)
 */
export async function findExistingHashes(
  db: SupabaseClient,
  transactions: DuplicateCandidate[],
): Promise<Set<string>> {
  const duplicates = new Set<string>();
  if (!transactions.length) return duplicates;

  // ── 1. Hash-аар шууд таних ────────────────────────────────────────────────
  const hashes = transactions.map((t) => t.dedupeHash);
  for (let i = 0; i < hashes.length; i += 500) {
    const { data } = await db
      .from('transactions')
      .select('dedupe_hash')
      .in('dedupe_hash', hashes.slice(i, i + 500));
    data?.forEach((r) => duplicates.add(r.dedupe_hash));
  }

  // ── 2. Цагийн бүсээс хамаарахгүй шалгуур ──────────────────────────────────
  const withBalance = transactions.filter((t) => t.closingBalance !== null);
  if (!withBalance.length) return duplicates;

  const balances = [...new Set(withBalance.map((t) => t.closingBalance!))];
  const seen = new Set<string>();
  for (let i = 0; i < balances.length; i += 500) {
    const { data } = await db
      .from('transactions')
      .select('amount, description, closing_balance')
      .in('closing_balance', balances.slice(i, i + 500));
    data?.forEach((r) => {
      const key = semanticKey({
        amount: Number(r.amount),
        description: String(r.description ?? ''),
        closingBalance: r.closing_balance === null ? null : Number(r.closing_balance),
      });
      if (key) seen.add(key);
    });
  }

  for (const t of withBalance) {
    const key = semanticKey(t);
    if (key && seen.has(key)) duplicates.add(t.dedupeHash);
  }

  return duplicates;
}
