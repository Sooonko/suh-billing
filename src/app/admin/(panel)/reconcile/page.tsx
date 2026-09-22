import { PendingAllocations, type PendingTxn } from '@/components/admin/PendingAllocations';
import { ReallocateButton } from '@/components/admin/ReallocateButton';
import { ReconcileImport } from '@/components/admin/ReconcileImport';
import { StatementTabs, type StatementRow } from '@/components/admin/StatementTabs';
import { ExcelExportButton } from '@/components/admin/filters/ExcelExportButton';
import { ResultSummary } from '@/components/admin/filters/ResultSummary';
import { WarningChip } from '@/components/admin/filters/WarningChip';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
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

  const [{ data: accounts }, { data: pending }, { count: autoFixableCount }, statement] =
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
      // Орсон хуулгыг данс тус бүрээр харуулна — админ БҮТНЭЭР нь шалгана.
      // fetchAllRows — PostgREST 1000 мөр л буцаадаг тул дутвал хуулга
      // бүтэн харагдахаа болино (энэ хуудасны гол зорилго нь тэр).
      fetchAllRows<{
        id: string;
        txn_date: string;
        amount: number;
        description: string;
        status: string;
        source_category: string;
        allocations: unknown;
      }>((from, to) =>
        db
          .from('transactions')
          .select('id, txn_date, amount, description, status, source_category, allocations(id, amount, category, flats(flat_number))')
          .order('txn_date', { ascending: false })
          .range(from, to),
      ),
    ]);

  // Данс тус бүрд нь бүлэглэнэ
  const byAccount = new Map<BillCategory, StatementRow[]>();
  for (const t of statement) {
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

  /**
   * Хуваарилагдаагүй / дутуу хуваарилсан гүйлгээний тоо.
   *
   * Эдгээр мөнгө банкинд ОРСОН боловч айлын үлдэгдэлд тусаагүй байна —
   * тиймээс дэлгэцийн дээр тоогоор хэлж өгнө.
   */
  const stmtUnmatched = statement.filter((t) => t.status === 'UNMATCHED').length;
  const stmtPartial = statement.filter((t) => t.status === 'PARTIAL').length;

  const exportHeaders = ['Огноо', 'Дүн', 'Гүйлгээний утга', 'Данс', 'Оногдсон тоот', 'Төлөв'];
  const exportRows: (string | number | null)[][] = [...byAccount.entries()].flatMap(
    ([accountCategory, rows]) =>
      rows.map((row) => [
        row.txn_date,
        row.amount,
        row.description,
        CATEGORY_LABEL[accountCategory] ?? accountCategory,
        row.allocations.map((a) => a.flat).join(', ') || '—',
        row.status,
      ]),
  );

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
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Орсон хуулга</h2>
            <p className="mt-0.5 text-sm text-slate-500">Данс сонгож харна.</p>
          </div>
          <ExcelExportButton
            filename="Банкны хуулга"
            sheetName="Хуулга"
            headers={exportHeaders}
            rows={exportRows}
          />
        </div>

        <ResultSummary scope="Бүх данс" count={statement.length} unit="гүйлгээ">
          <WarningChip count={stmtUnmatched} label="гүйлгээ хуваарилаагүй" />
          <WarningChip count={stmtPartial} label="гүйлгээ дутуу хуваарилсан" />
        </ResultSummary>
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
