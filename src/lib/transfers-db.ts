import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { markDuplicateTransfers, transferKey, type NewTransfer, type TransferRecipient } from '@/lib/transfers';

/**
 * Шилжүүлгийг DB-тэй тулгах, бүртгэх. Хуулгын импорт ба Excel импорт
 * хоёулаа ЭНИЙГ дуудна — давхардлын дүрэм нэг газар.
 */

/** `transfers`-ийн аль нь DB-д аль хэдийн байгааг (ижил дараалалаар) буцаана */
export async function findDuplicateTransfers(db: SupabaseClient, transfers: NewTransfer[]): Promise<boolean[]> {
  if (!transfers.length) return [];

  const dates = transfers.map((t) => t.transferDate).sort();
  const rows = await fetchAllRows<{ recipient: TransferRecipient; transfer_date: string; amount: number }>(
    (from, to) =>
      db
        .from('utility_transfers')
        .select('recipient, transfer_date, amount')
        .gte('transfer_date', dates[0])
        .lte('transfer_date', dates[dates.length - 1])
        .order('id')
        .range(from, to),
  );

  const existing = rows.map((r) =>
    transferKey({ recipient: r.recipient, transferDate: String(r.transfer_date).slice(0, 10), amount: Number(r.amount) }),
  );
  return markDuplicateTransfers(transfers, existing);
}

/**
 * Шинэ шилжүүлгийг бүртгэнэ. Аль хэдийн байгааг алгасна — нэг файлыг
 * хэдэн ч удаа оруулсан давхардахгүй.
 */
export async function insertTransfers(
  db: SupabaseClient,
  transfers: NewTransfer[],
  meta: { source: 'STATEMENT' | 'LEDGER'; bankAccountId?: string; batchId: string; createdBy: string },
): Promise<{ inserted: number; duplicates: number; error?: string }> {
  const isDuplicate = await findDuplicateTransfers(db, transfers);
  const fresh = transfers.filter((_, i) => !isDuplicate[i]);
  const duplicates = transfers.length - fresh.length;
  if (!fresh.length) return { inserted: 0, duplicates };

  const { error } = await db.from('utility_transfers').insert(
    fresh.map((t) => ({
      recipient: t.recipient,
      transfer_date: t.transferDate,
      amount: t.amount,
      description: t.description || null,
      note: t.note,
      source: meta.source,
      bank_account_id: meta.bankAccountId ?? null,
      import_batch_id: meta.batchId,
      created_by: meta.createdBy,
    })),
  );
  if (error) return { inserted: 0, duplicates, error: error.message };
  return { inserted: fresh.length, duplicates };
}
