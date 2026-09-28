import { notFound } from 'next/navigation';
import { ResidentDashboard } from '@/components/resident/ResidentDashboard';
import {
  allocatePaymentsToMonths,
  splitDebtByMonth,
  type InvoiceLine,
  type PaymentLine,
} from '@/lib/billing/fifo-debt';
import { hasDebt } from '@/lib/money';
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

  /** Төлбөрүүд — эхлээд хуваарилалт бодохын тулд хавтгай хэлбэрээр */
  const paymentLines: PaymentLine[] = (paid ?? []).flatMap((row, i) => {
    const txn = row.transactions as unknown as { txn_date: string } | null;
    if (!txn?.txn_date) return [];
    return [
      {
        id: `pay-${i}`,
        category: row.category as BillCategory,
        date: txn.txn_date,
        amount: Number(row.amount),
      },
    ];
  });

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

  const invoiceLines: InvoiceLine[] = (billed ?? []).map((row) => ({
    month: row.billing_month as string,
    category: row.category as BillCategory,
    billed: Number(row.bill_amount),
  }));

  /**
   * Төлбөр бүр АЛЬ САРЫГ хассаныг FIFO-гоор тогтооно — задаргаатай ижил
   * дүрэм тул хоёр хүснэгт зөрөх боломжгүй.
   */
  const coverage = allocatePaymentsToMonths(invoiceLines, paymentLines);
  const payments: PaymentEntry[] = paymentLines
    .map((p) => ({
      id: p.id,
      // Шүүлт нь төлбөр ХИЙСЭН сараар — «би 9 сард хэд төлсөн бэ»
      month: p.date.slice(0, 7),
      date: p.date,
      category: p.category,
      amount: p.amount,
      covers: coverage.get(p.id) ?? [],
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Задаргаа нь бүрэн төлөгдсөн сарыг Ч буцаадаг — өртэйг л харуулна.
  // 50₮-өөс бага үлдэгдлийг төлөх боломжгүй (эргэлтэд байхгүй) тул
  // «0₮ өртэй» гэсэн утгагүй мөр үүсгэхгүй (money.ts-ийг үзнэ үү).
  const debts: DebtRow[] = splitDebtByMonth(invoiceLines, paidByCategory)
    .filter((row) => hasDebt(row.remaining))
    .map(({ month, category, billed: amount, remaining }) => ({
      month,
      category,
      billed: amount,
      remaining,
    }));

  /**
   * Дансны дугаарууд — «Төлбөр төлөх» хэсэгт хэрэгтэй.
   * Уншигдахгүй бол дэлгэц унахгүй, зүгээр л товч гарахгүй.
   */
  const { data: accountRows } = await db
    .from('bank_accounts')
    .select('category, account_number, display_name');
  const accounts: ResidentDashboardData['accounts'] = {};
  for (const row of accountRows ?? []) {
    accounts[row.category as BillCategory] = {
      number: String(row.account_number),
      name: (row.display_name as string | null)?.trim() || null,
    };
  }

  const data: ResidentDashboardData = {
    accounts,
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
