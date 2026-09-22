import { notFound } from 'next/navigation';
import { ResidentDashboard } from '@/components/resident/ResidentDashboard';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  BillCategory,
  DebtRow,
  FlatCategoryState,
  PaymentEntry,
  ResidentDashboardData,
} from '@/lib/types';

/**
 * Оршин суугчийн дэлгэц — Server Component.
 *
 * Дата татах ажил СЕРВЕР дээр болно. Браузер руу Supabase key огт очихгүй,
 * зөвхөн тухайн нэг тоотын дата очно.
 */
export default async function FlatPage({ params }: { params: Promise<{ flat: string }> }) {
  const { flat } = await params;
  const flatNumber = Number(flat);
  if (!Number.isInteger(flatNumber) || flatNumber <= 0) notFound();

  const db = createAdminClient();

  const { data: flatRow } = await db
    .from('flats')
    .select('id, flat_number, owner_name')
    .eq('flat_number', flatNumber)
    .eq('is_active', true)
    .maybeSingle();

  if (!flatRow) notFound();

  const [{ data: states }, { data: paid }, { data: billed }] = await Promise.all([
    db.from('v_flat_category_state').select('*').eq('flat_id', flatRow.id),
    // Төлбөрийн түүх. Огноо нь БАНКНЫ гүйлгээнийх, бүртгэсэн огноо биш —
    // оршин суугч өөрийн хуулгатайгаа тулгаж чадах ёстой.
    db
      .from('allocations')
      .select('amount, category, transactions(txn_date)')
      .eq('flat_id', flatRow.id)
      .limit(500),
    db
      .from('invoices')
      .select('billing_month, category, bill_amount')
      .eq('flat_id', flatRow.id)
      .limit(500),
  ]);

  /**
   * Төлсөн баримтууд. Огноо нь БАНКНЫ гүйлгээнийх — оршин суугч өөрийн
   * хуулгатайгаа тулгаж чадах ёстой.
   */
  // (ангилал, сар) → тэр сарын нэхэмжлэл. Төлбөрийн хажууд харуулна.
  const billedByKey = new Map<string, number>();
  for (const row of billed ?? []) {
    billedByKey.set(`${row.category}-${row.billing_month}`, Number(row.bill_amount));
  }

  const payments: PaymentEntry[] = (paid ?? [])
    .flatMap((row, i) => {
      const txn = row.transactions as unknown as { txn_date: string } | null;
      if (!txn?.txn_date) return [];
      const month = String(txn.txn_date).slice(0, 7);
      return [
        {
          id: `pay-${i}`,
          month,
          date: txn.txn_date,
          category: row.category as BillCategory,
          amount: Number(row.amount),
          billedThatMonth: billedByKey.get(`${row.category}-${month}`) ?? null,
        },
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  /**
   * Өр үүссэн саруудыг FIFO дүрмээр тогтооно.
   *
   * Төлбөр тодорхой нэхэмжлэлд наалддаггүй тул «энэ сар төлөгдсөн үү»
   * гэдгийг дүрмээр л шийднэ: тухайн ангилалд төлсөн НИЙТ мөнгийг хамгийн
   * хуучин сараас эхлэн зарцуулна. Үлдсэн нь өр.
   */
  const paidByCategory = new Map<BillCategory, number>();
  for (const row of paid ?? []) {
    const category = row.category as BillCategory;
    paidByCategory.set(category, (paidByCategory.get(category) ?? 0) + Number(row.amount));
  }

  const debts: DebtRow[] = [];
  const invoicesByCategory = new Map<BillCategory, { month: string; billed: number }[]>();
  for (const row of billed ?? []) {
    const category = row.category as BillCategory;
    const list = invoicesByCategory.get(category) ?? [];
    list.push({ month: row.billing_month as string, billed: Number(row.bill_amount) });
    invoicesByCategory.set(category, list);
  }

  for (const [category, invoices] of invoicesByCategory) {
    let pool = paidByCategory.get(category) ?? 0;
    for (const invoice of invoices.sort((a, b) => a.month.localeCompare(b.month))) {
      const applied = Math.min(pool, invoice.billed);
      pool -= applied;
      const remaining = Math.round((invoice.billed - applied) * 100) / 100;
      if (remaining > 0) debts.push({ month: invoice.month, category, billed: invoice.billed, remaining });
    }
  }
  debts.sort((a, b) => a.month.localeCompare(b.month) || a.category.localeCompare(b.category));

  const data: ResidentDashboardData = {
    flatNumber: flatRow.flat_number,
    ownerName: flatRow.owner_name,
    categories: (states ?? []).map((s) => ({
      ...s,
      // numeric баганууд PostgREST-ээс ТЕКСТЭЭР ирдэг тул тоо болгоно
      balance: Number(s.balance),
      // ⚠️ schema.sql-ыг дахин RUN хийх хүртэл view-д эдгээр багана байхгүй.
      // Тэр үед NaN гаргахгүйн тулд үлдэгдлээс ойролцоо утга гаргана.
      total_billed: Number(s.total_billed ?? s.bill_amount ?? 0),
      total_paid: Number(
        s.total_paid ?? Number(s.bill_amount ?? 0) - Number(s.balance),
      ),
      bill_amount: s.bill_amount === null ? null : Number(s.bill_amount),
      usage_amount: s.usage_amount === null ? null : Number(s.usage_amount),
      hot_prev: s.hot_prev === null ? null : Number(s.hot_prev),
      hot_current: s.hot_current === null ? null : Number(s.hot_current),
      cold_prev: s.cold_prev === null ? null : Number(s.cold_prev),
      cold_current: s.cold_current === null ? null : Number(s.cold_current),
    })) as FlatCategoryState[],

    payments,
    debts,
  };

  return (
    <ResidentDashboard data={data} />
  );
}
