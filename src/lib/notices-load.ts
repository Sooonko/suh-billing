import { buildFlatNotice, type NoticeInvoiceRow, type NoticesPayload } from '@/lib/notices';
import { SOH } from '@/lib/soh-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import type { BillCategory } from '@/lib/types';

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/**
 * Хаалганы мэдэгдлийн өгөгдлийг DB-ээс татаж бодно.
 *
 * Зөвхөн үлдэгдэлтэй айлууд буцна. Сонгосон сараас хойшхи нэхэмжлэлийг
 * тооцохгүй — 9 сарын цаасан дээр 10 сарын дүн орох ёсгүй.
 *
 * @param month 'YYYY-MM' — шалгасан байх ёстой
 */
export async function loadNotices(month: string): Promise<NoticesPayload> {
  const db = createAdminClient();
  // Supabase хол байгаа тул хүсэлт бүр ~1с — дөрвүүлийг зэрэг явуулна
  const [flatRows, balanceRows, invoiceRows, accountRows] = await Promise.all([
    fetchAllRows<{ id: string; flat_number: number }>((from, to) =>
      db.from('flats').select('id, flat_number').eq('is_active', true).range(from, to),
    ),
    fetchAllRows<{ flat_id: string; category: string; total_paid: number }>((from, to) =>
      db.from('v_flat_balances').select('flat_id, category, total_paid').range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      db
        .from('invoices')
        .select(
          'flat_id, category, billing_month, bill_amount, prev_reading, current_reading, hot_prev, hot_current, cold_prev, cold_current, usage_amount',
        )
        .lte('billing_month', month)
        .range(from, to),
    ),
    db.from('bank_accounts').select('account_number, category'),
  ]);

  const paidByFlat = new Map<string, Map<BillCategory, number>>();
  for (const row of balanceRows) {
    const map = paidByFlat.get(row.flat_id) ?? new Map<BillCategory, number>();
    map.set(row.category as BillCategory, Number(row.total_paid));
    paidByFlat.set(row.flat_id, map);
  }

  const invoicesByFlat = new Map<string, NoticeInvoiceRow[]>();
  for (const row of invoiceRows) {
    const id = row.flat_id as string;
    const list = invoicesByFlat.get(id) ?? [];
    list.push({
      month: row.billing_month as string,
      category: row.category as BillCategory,
      billed: Number(row.bill_amount),
      // numeric баганууд PostgREST-ээс текстээр ирдэг
      prev_reading: num(row.prev_reading),
      current_reading: num(row.current_reading),
      hot_prev: num(row.hot_prev),
      hot_current: num(row.hot_current),
      cold_prev: num(row.cold_prev),
      cold_current: num(row.cold_current),
      usage_amount: num(row.usage_amount),
    });
    invoicesByFlat.set(id, list);
  }

  const notices = flatRows
    .sort((a, b) => a.flat_number - b.flat_number)
    .map((f) =>
      buildFlatNotice(
        f.flat_number,
        invoicesByFlat.get(f.id) ?? [],
        paidByFlat.get(f.id) ?? new Map(),
        month,
      ),
    )
    .filter((n) => n !== null);

  const accounts: NoticesPayload['accounts'] = {};
  for (const a of accountRows.data ?? []) {
    accounts[a.category as BillCategory] = a.account_number as string;
  }

  const payload: NoticesPayload = {
    month,
    buildingName: SOH.name.trim(),
    phone: SOH.contact.phone,
    accounts,
    notices,
  };
  return payload;
}
