import { PendingAllocations, type PendingTxn } from '@/components/admin/PendingAllocations';
import { ReallocateButton } from '@/components/admin/ReallocateButton';
import { ReconcileImport } from '@/components/admin/ReconcileImport';
import { StatementTabs, type StatementRow } from '@/components/admin/StatementTabs';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATEGORY_LABEL, type BankAccount, type BillCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Модуль 2 — Хуулга тулгах.
 *
 * Хоёр хэсэгтэй:
 *  1. Excel импорт (preview → commit, автомат тоот таналт)
 *  2. Гар шалгалт — автоматаар оногдоогүй гүйлгээг админ өөрөө оноох
 */
export default async function AdminReconcilePage() {
  const db = createAdminClient();

  const [{ data: accounts }, { data: pending }, { count: autoFixableCount }, { data: statement }] =
    await Promise.all([
      db.from('bank_accounts').select('id, account_number, category, display_name').order('category'),
      db
        .from('v_transactions_remaining')
        .select('id, txn_date, amount, remaining, description, source_category, parsed_flat_number, review_reason, status')
        .in('status', ['UNMATCHED', 'PARTIAL'])
        .order('txn_date', { ascending: false })
        .limit(200),
      // Тоот танигдсан атлаа хуваарилагдаагүй гүйлгээний БҮРЭН тоо.
      // Дээрх жагсаалт limit(200)-тай тул түүнээс тоолж болохгүй — товч дээрх
      // тоо бодитоос бага харагдана.
      db
        .from('v_transactions_remaining')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'UNMATCHED')
        .not('parsed_flat_number', 'is', null),
      // Орсон хуулгыг данс тус бүрээр харуулна — админ бүтнээр нь шалгана
      db
        .from('transactions')
        .select('id, txn_date, amount, description, status, source_category, allocations(id, amount, category, flats(flat_number))')
        .order('txn_date', { ascending: false })
        .limit(2000),
    ]);

  // Данс тус бүрд нь бүлэглэнэ
  const byAccount = new Map<BillCategory, StatementRow[]>();
  for (const t of statement ?? []) {
    const category = t.source_category as BillCategory;
    const list = byAccount.get(category) ?? [];
    list.push({
      id: t.id as string,
      txn_date: t.txn_date as string,
      amount: Number(t.amount),
      description: t.description as string,
      status: t.status as string,
      allocations: ((t.allocations ?? []) as unknown as {
        id: string;
        amount: number;
        category: BillCategory;
        flats: { flat_number: number } | null;
      }[]).map((a) => ({
        id: a.id,
        flat: a.flats ? String(a.flats.flat_number) : '—',
        amount: Number(a.amount),
        category: a.category,
      })),
    });
    byAccount.set(category, list);
  }

  const autoFixable = autoFixableCount ?? 0;

  const transactions: PendingTxn[] = (pending ?? []).map((t) => ({
    ...t,
    amount: Number(t.amount),
    remaining: Number(t.remaining),
  })) as PendingTxn[];

  // ── Асуудлын хүнд байдлаар нь ХУВААНА ────────────────────────────────────
  // Тоот танигдаагүй гүйлгээ л жинхэнэ ажил шаардана — админ утгыг уншиж,
  // хэний төлбөр болохыг шийднэ. Тоот танигдсан хэрнээ хуваарилагдаагүйг
  // нэг товчоор цэгцэлнэ. Тиймээс эхнийхийг ДЭЭР нь гаргана.
  const needsDecision = transactions
    .filter((t) => t.parsed_flat_number === null)
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date));

  const autoAssignable = transactions
    .filter((t) => t.parsed_flat_number !== null)
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date));

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
          Банкны дансны хуулга
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Банкны хуулгыг оруулахад тоотыг автоматаар таньж хуваарилна. Эргэлзээтэйг доорх гар
          шалгалтад гаргана.
        </p>
        <ReconcileImport accounts={(accounts ?? []) as BankAccount[]} />
      </section>

      {/* ── Орсон хуулга — данс тус бүрээр ──────────────────────────────── */}
      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Орсон хуулга</h2>
          <span className="text-xs text-slate-400">{statement?.length ?? 0} гүйлгээ</span>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Данс сонгож харна.
        </p>
        <StatementTabs
          accounts={(accounts ?? []).map((account) => ({
            category: account.category as BillCategory,
            label: CATEGORY_LABEL[account.category as BillCategory] ?? account.display_name,
            rows: byAccount.get(account.category as BillCategory) ?? [],
          }))}
        />
      </section>

      {/* ── 1. Жинхэнэ ажил: тоот танигдаагүй ──────────────────────────── */}
      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Шийдвэр хүлээж байгаа
          </h2>
          <span className="text-xs text-slate-400">{needsDecision.length} гүйлгээ</span>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Гүйлгээний утгаас тоот танигдаагүй эсвэл хэд хэдэн тоот тохирсон. Утгыг уншаад
          өөрөө оноох хэрэгтэй.
        </p>
        <PendingAllocations
          transactions={needsDecision}
          emptyMessage="Шийдвэр хүлээж байгаа гүйлгээ байхгүй"
        />
      </section>

      {/* ── 2. Нэг товчоор цэгцлэх: тоот танигдсан ──────────────────────── */}
      {(autoAssignable.length > 0 || autoFixable > 0) && (
        <section>
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Тоот танигдсан, хуваарилагдаагүй
            </h2>
            <span className="text-xs text-slate-400">{autoAssignable.length} гүйлгээ</span>
          </div>
          <p className="mb-3 text-sm text-slate-500">
            Эдгээрийг гараар оноох шаардлагагүй — доорх товчоор бүгдийг нь цэгцэлнэ.
          </p>
          <ReallocateButton count={autoFixable} />
          <PendingAllocations
            transactions={autoAssignable}
            emptyMessage="Бүх гүйлгээ айлд оногдсон байна"
          />
        </section>
      )}
    </div>
  );
}
