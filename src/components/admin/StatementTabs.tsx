'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMnt } from '@/lib/format';
import { CATEGORY_LABEL, type BillCategory } from '@/lib/types';

/**
 * Орсон банкны хуулга — данс тус бүрээр ТАБААР.
 *
 * ⚠️ Яагаад таб вэ: гурван дансны хүснэгтийг доош нь дараалуулбал хуудас
 * хэт урт болж, гүйлгэж хайхад хэцүү. Нэг удаад нэг данс харуулбал
 * хуудасны өндөр тогтмол хэвээр байна.
 *
 * Таб нь URL биш ДОТООД төлөв — хуудас дахин ачаалагдвал дээрх импортын
 * файл, preview алдагдах байсан.
 */

export interface StatementRow {
  id: string;
  txn_date: string;
  amount: number;
  description: string;
  status: string;
  allocations: { id: string; flat: string; amount: number; category: BillCategory }[];
}

export interface AccountStatement {
  category: BillCategory;
  label: string;
  rows: StatementRow[];
}

const STATUS_STYLE: Record<string, string> = {
  MATCHED: 'bg-emerald-100 text-emerald-800',
  PARTIAL: 'bg-amber-100 text-amber-900',
  UNMATCHED: 'bg-red-100 text-red-800',
  IGNORED: 'bg-slate-100 text-slate-600',
};

const STATUS_LABEL: Record<string, string> = {
  MATCHED: 'Хуваарилсан',
  PARTIAL: 'Дутуу',
  UNMATCHED: 'Хуваарилаагүй',
  IGNORED: 'Тооцохгүй',
};

/**
 * Нэг гүйлгээний мөр.
 *
 * Буруу оногдсоныг ЗАСАХ = хуваарилалтыг буцаах. Гүйлгээ өөрөө хэвээр
 * үлдэж (баримт тул хэзээ ч устгахгүй), зөвхөн хуваарилалт устна. Дараа нь
 * доорх «Шийдвэр хүлээж байгаа» хэсэгт гарч ирэх тул зөв айлд оноож болно.
 */
function Row({
  row,
  duplicate,
  accountCategory,
}: {
  row: StatementRow;
  duplicate: boolean;
  /** Аль данснаас ирсэн бэ — хуваарилалт өөр ангилалд очсоныг харуулахад */
  accountCategory: BillCategory;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function undo(allocationId: string, flat: string) {
    if (!confirm(`${flat} тоотод оногдсон ${formatMnt(row.amount)} хуваарилалтыг буцаах уу?\n\nГүйлгээ хэвээр үлдэнэ — зөвхөн оноолт цуцлагдаж, «Шийдвэр хүлээж байгаа» хэсэгт орно.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/allocations?id=${allocationId}`, { method: 'DELETE' });
    setBusy(false);

    if (!response.ok) {
      // Дуугүй амжилтгүй болбол админ юу ч болоогүйг мэдэхгүй өнгөрнө
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Буцаахад алдаа гарлаа');
      return;
    }
    router.refresh();
  }

  return (
    <tr className={duplicate ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-slate-500">
        {new Date(row.txn_date).toLocaleDateString('mn-MN')}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
        {formatMnt(row.amount)}
      </td>
      <td className="max-w-md px-3 py-2">
        <span className="block truncate text-xs" title={row.description}>
          {row.description}
        </span>
        {duplicate && (
          <span className="text-[11px] font-medium text-amber-700">
            Энэ тоот энэ дансанд олон удаа төлсөн байна
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {row.allocations.length === 0 ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          row.allocations.map((a) => (
            <span key={a.id} className="mr-2 inline-block">
              <span className="font-semibold tabular-nums">{a.flat}</span>
              {row.allocations.length > 1 && (
                <span className="ml-1 text-xs font-normal text-slate-400">
                  {formatMnt(a.amount)}
                </span>
              )}
              {/* Мөнгө өөр ангилалд оногдсон бол ЗААВАЛ харуулна — эс бөгөөс
                  админ шилжүүлсэн эсэхээ мэдэхгүй өнгөрнө */}
              {a.category !== accountCategory && (
                <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900">
                  → {CATEGORY_LABEL[a.category]}
                </span>
              )}
            </span>
          ))
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            STATUS_STYLE[row.status] ?? STATUS_STYLE.IGNORED
          }`}
        >
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right">
        {row.allocations.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy}
            onClick={() => undo(a.id, a.flat)}
            className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            {busy ? '…' : 'Засах'}
          </button>
        ))}
        {error && (
          <p role="alert" className="mt-1 text-[11px] text-red-600">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

export function StatementTabs({ accounts }: { accounts: AccountStatement[] }) {
  const [active, setActive] = useState<BillCategory>(
    // Хуулга орсон эхний данс — хоосон таб анхдагчаар нээгдэх нь утгагүй
    accounts.find((a) => a.rows.length > 0)?.category ?? accounts[0]?.category ?? 'WATER_HEAT',
  );
  const [onlyPending, setOnlyPending] = useState(false);

  const current = accounts.find((a) => a.category === active);
  const rows = (current?.rows ?? []).filter(
    (r) => !onlyPending || r.status === 'UNMATCHED' || r.status === 'PARTIAL',
  );
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const pendingCount = (current?.rows ?? []).filter(
    (r) => r.status === 'UNMATCHED' || r.status === 'PARTIAL',
  ).length;

  // Нэг тоот энэ дансанд ОЛОН удаа төлсөн бол тэмдэглэнэ. Хууль ёсны байж
  // болно (өр барагдуулсан) ч буруу оноолт ч байж болно — админ хараг.
  const seen = new Map<string, number>();
  for (const row of current?.rows ?? []) {
    const flat = row.allocations[0]?.flat;
    if (flat) seen.set(flat, (seen.get(flat) ?? 0) + 1);
  }
  const repeated = new Set([...seen.entries()].filter(([, n]) => n > 1).map(([flat]) => flat));

  return (
    <div>
      {/* Табын мөр — данс бүрийн тоо, дүн хамт харагдана */}
      <div role="tablist" aria-label="Данс" className="mb-3 flex flex-wrap gap-2">
        {accounts.map((account) => {
          const isActive = account.category === active;
          const sum = account.rows.reduce((s, r) => s + r.amount, 0);
          const pending = account.rows.filter(
            (r) => r.status === 'UNMATCHED' || r.status === 'PARTIAL',
          ).length;

          return (
            <button
              key={account.category}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActive(account.category)}
              className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                {account.label}
                {pending > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {pending}
                  </span>
                )}
              </span>
              <span className={`block text-xs ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                {account.rows.length} гүйлгээ · {formatMnt(sum)}
              </span>
            </button>
          );
        })}
      </div>

      {pendingCount > 0 && (
        <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Зөвхөн хуваарилагдаагүйг харах ({pendingCount})
        </label>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center text-sm text-slate-500">
          {onlyPending
            ? 'Хуваарилагдаагүй гүйлгээ байхгүй.'
            : 'Энэ данс руу хуулга хараахан ороогүй байна.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-medium">Огноо</th>
                  <th className="px-3 py-2 text-right font-medium">Дүн</th>
                  <th className="px-3 py-2 text-left font-medium">Гүйлгээний утга</th>
                  <th className="px-3 py-2 text-left font-medium">Оногдсон</th>
                  <th className="px-3 py-2 text-left font-medium">Төлөв</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    duplicate={repeated.has(row.allocations[0]?.flat)}
                    accountCategory={active}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-baseline justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="text-sm text-slate-600">
              {CATEGORY_LABEL[active]} · {rows.length} гүйлгээ
            </span>
            <span className="font-bold tabular-nums text-slate-900">{formatMnt(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
