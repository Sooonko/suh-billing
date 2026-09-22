'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMnt } from '@/lib/format';
import { readSheetRows } from '@/lib/read-sheet';
import { CATEGORY_LABEL, type BankAccount, type BillCategory } from '@/lib/types';

/**
 * Банкны хуулгын импорт — 2 алхамтай.
 *
 *   Данс + файл → PREVIEW (DB-д юу ч бичихгүй) → админ хараад → COMMIT
 *
 * Данс сонгосноор категори аяндаа тодорхой болно — гүйлгээний утгаас
 * категори таах шаардлагагүй.
 */

interface PreviewTxn {
  rowIndex: number;
  txnDate: string;
  amount: number;
  description: string;
  flatNumber: number | null;
  confidence: string;
  candidates: number[];
  reason?: string;
  isDuplicate: boolean;
  currentBalance: number | null;
  overpayAmount: number | null;
  needsAdminDecision: boolean;
  /** Энэ айл энэ хуулгад хэдэн удаа төлсөн бэ */
  paymentsForFlat: number;
}

interface Preview {
  account: { id: string; category: BillCategory; displayName: string };
  /** Хуулгын утгаас таасан ангилал — буруу данс сонгосныг илрүүлэхэд */
  categoryHint: {
    counts: Record<BillCategory, number>;
    dominant: BillCategory | null;
    matched: number;
    total: number;
  };
  /** Толгой мөрнөөс ямар багана танисан — андуурсан эсэхийг админ хардаг */
  columns: Record<string, string | undefined>;
  summary: {
    totalRows: number;
    skipped: number;
    duplicates: number;
    autoMatched: number;
    needsReview: number;
    needsDecision: number;
    totalAmount: number;
  };
  transactions: PreviewTxn[];
  skipped: { rowIndex: number; description: string; reason: string }[];
}

interface CommitResult {
  imported: number;
  duplicatesSkipped: number;
  autoMatched: number;
  needsReview: number;
}

export function ReconcileImport({ accounts }: { accounts: BankAccount[] }) {
  const router = useRouter();
  const [bankAccountId, setBankAccountId] = useState(accounts[0]?.id ?? '');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  /** Толгой Excel дээр хэддүгээр мөрөнд байсан бэ — мөрийн дугаарыг зөв гаргахад */
  const [headerRow, setHeaderRow] = useState(1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'read' | 'preview' | 'commit' | null>(null);

  function reset() {
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    reset();
    setBusy('read');
    setFileName(file.name);

    try {
      const { rows: parsed, headerRow: header } = await readSheetRows(file);
      setRows(parsed);
      setHeaderRow(header);
      if (!parsed.length) setError('Файл хоосон байна');
    } catch {
      setError('Excel файл уншигдсангүй. .xlsx эсвэл .csv байх ёстой.');
      setRows(null);
    } finally {
      setBusy(null);
    }
  }

  async function send(step: 'preview' | 'commit') {
    if (!rows || !bankAccountId) return;
    setBusy(step);
    setError(null);

    const response = await fetch(`/api/admin/reconcile/${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankAccountId, rows, headerRow }),
    });
    const data = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(data.error ?? 'Алдаа гарлаа');
      return;
    }

    if (step === 'preview') setPreview(data as Preview);
    else {
      setResult(data as CommitResult);
      setPreview(null);
      // Гар шалгалтын жагсаалт шинэчлэгдэхийн тулд
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Данс ба файл ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">1. Данс ба файл</h2>

        {accounts.length === 0 ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            Данс бүртгэгдээгүй байна. bank_accounts хүснэгтийг шалгана уу.
          </p>
        ) : (
          <div className="mb-4">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Хуулга аль данснаас нь вэ?
            </span>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    setBankAccountId(account.id);
                    reset();
                  }}
                  aria-pressed={bankAccountId === account.id}
                  className={`rounded-xl border px-5 py-3 text-left text-sm transition ${
                    bankAccountId === account.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-medium">
                    {CATEGORY_LABEL[account.category] ?? account.display_name}
                  </span>
                  <span className="block font-mono text-[11px] opacity-70">
                    {account.account_number}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="stmt" className="mb-1.5 block text-sm font-medium text-slate-700">
            Хуулгын Excel
          </label>
          <input
            id="stmt"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="block w-full cursor-pointer rounded-lg border border-slate-300 text-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="mt-2 text-xs text-slate-500">
            Толгой мөрөнд <span className="font-semibold">Орлого</span> ба{' '}
            <span className="font-semibold">Гүйлгээний утга</span> багана байх ёстой. Зарлагын мөрийг
            систем өөрөө алгасна.
          </p>
          {fileName && rows && (
            <p className="mt-2 text-sm text-slate-600">
              📄 {fileName} — <span className="font-semibold">{rows.length}</span> мөр уншсан
            </p>
          )}
        </div>

        {rows && rows.length > 0 && !preview && !result && (
          <button
            type="button"
            onClick={() => send('preview')}
            disabled={busy !== null || !bankAccountId}
            className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {busy === 'preview' ? 'Тулгаж байна…' : 'Тулгаж харах (DB-д бичихгүй)'}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── 2. Тулгалтын үр дүн ───────────────────────────────────────────── */}
      {preview && (() => {
        // Шинээр бүртгэгдэх мөрийн тоо. Давхардсаныг оруулахгүй.
        const newRows = preview.summary.autoMatched + preview.summary.needsReview;
        return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">
            2. Тулгалтын үр дүн — {preview.account.displayName}
          </h2>

          {/* ⚠️ БУРУУ ДАНС — мөнгө буруу ангилалд орохоос сэргийлнэ */}
          {preview.categoryHint?.dominant &&
            preview.categoryHint.dominant !== preview.account.category && (
              <div className="mb-4 rounded-lg border-2 border-red-400 bg-red-50 p-4">
                <p className="font-bold text-red-900">⛔ Данс буруу сонгосон байж магадгүй</p>
                <p className="mt-1.5 text-sm text-red-800">
                  Та <span className="font-bold">«{preview.account.displayName}»</span> данс
                  сонгосон. Гэвч гүйлгээний утгууд{' '}
                  <span className="font-bold">
                    «{CATEGORY_LABEL[preview.categoryHint.dominant]}»
                  </span>{' '}
                  гэж заасан байна ({preview.categoryHint.counts[preview.categoryHint.dominant]}/
                  {preview.categoryHint.total} гүйлгээ).
                </p>
                <p className="mt-2 text-sm text-red-800">
                  Ингэж бүртгэвэл төлбөр буруу ангилалд орно — айлууд нэг ангилалдаа өртэй,
                  нөгөөд нь илүү төлөлттэй харагдана. Дээрээс зөв данс сонгоод дахин шалгана уу.
                </p>
              </div>
            )}

          {/* Ямар багана танисныг харуулна — буруу таньсныг эндээс шууд мэдэнэ */}
          <dl className="mb-4 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {[
              ['Орлого', preview.columns.credit],
              ['Зарлага', preview.columns.debit],
              ['Нэг дүн', preview.columns.amount],
              ['Утга', preview.columns.description],
              ['Огноо', preview.columns.date],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label as string}>
                  <dt className="inline font-medium text-slate-400">{label}: </dt>
                  <dd className="inline font-mono">{value}</dd>
                </div>
              ))}
          </dl>

          <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-lg bg-emerald-50 p-3">
              <dt className="text-xs font-medium text-emerald-800">Автомат таарсан</dt>
              <dd className="text-2xl font-bold tabular-nums text-emerald-900">
                {preview.summary.autoMatched}
              </dd>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <dt className="text-xs font-medium text-amber-900">Гар шалгалт</dt>
              <dd className="text-2xl font-bold tabular-nums text-amber-900">
                {preview.summary.needsReview}
              </dd>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <dt className="text-xs font-medium text-blue-800">Илүү төлөлт</dt>
              <dd className="text-2xl font-bold tabular-nums text-blue-900">
                {preview.summary.needsDecision}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <dt className="text-xs font-medium text-slate-600">Давхардсан</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">
                {preview.summary.duplicates}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <dt className="text-xs font-medium text-slate-600">Алгассан</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">
                {preview.summary.skipped}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <dt className="text-xs font-medium text-slate-600">Нийт орлого</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">
                {formatMnt(preview.summary.totalAmount)}
              </dd>
            </div>
          </dl>

          {/* Бүх мөр давхардсан — энэ хуулгыг аль хэдийн оруулсан байна */}
          {newRows === 0 && preview.summary.duplicates > 0 && (
            <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">
                ⚠️ Энэ хуулгыг АЛЬ ХЭДИЙН оруулсан байна
              </p>
              <p className="mt-1.5 text-sm text-amber-900">
                {preview.summary.duplicates} гүйлгээ бүгд датабазад байна — шинээр бүртгэх зүйл
                алга. Огноо, дүн, гүйлгээний утга гурвууланг нь тулгаж шалгасан.
              </p>
              <p className="mt-2 text-sm text-amber-900">
                Дахин бүртгэвэл төлбөр давхарлах байсан. Систем татгалзаж байна.
              </p>
            </div>
          )}

          {newRows > 0 && preview.summary.duplicates > 0 && (
            <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              ℹ️ <span className="font-semibold">{preview.summary.duplicates}</span> гүйлгээ аль
              хэдийн бүртгэгдсэн байна — дахин бүртгэхгүй, чимээгүй алгасна.
            </p>
          )}

          {preview.skipped.length > 0 && (
            <details className="mb-4 rounded-lg border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
                Бүртгэхгүй {preview.skipped.length} мөр — шалтгаанаар нь харах
              </summary>
              <div className="border-t border-slate-200 px-4 py-3">
                {/* Шалтгаанаар бүлэглэнэ: "Зарлагын гүйлгээ" ихэвчлэн олон байна */}
                {Object.entries(
                  preview.skipped.reduce<Record<string, typeof preview.skipped>>((groups, row) => {
                    (groups[row.reason] ??= []).push(row);
                    return groups;
                  }, {}),
                ).map(([reason, group]) => (
                  <div key={reason} className="mb-3 last:mb-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {reason} — {group.length}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {group.slice(0, 15).map((row) => (
                        <li key={row.rowIndex} className="truncate text-xs text-slate-600">
                          <span className="text-slate-400">мөр {row.rowIndex}:</span>{' '}
                          {row.description || '(утга хоосон)'}
                        </li>
                      ))}
                      {group.length > 15 && (
                        <li className="text-xs text-slate-400">… бас {group.length - 15} мөр</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="mb-5 max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Огноо</th>
                  <th className="px-3 py-2 text-right font-medium">Дүн</th>
                  <th className="px-3 py-2 text-left font-medium">Гүйлгээний утга</th>
                  <th className="px-3 py-2 text-left font-medium">Тоот</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.transactions.map((txn) => (
                  <tr
                    key={txn.rowIndex}
                    className={
                      txn.isDuplicate
                        ? 'bg-slate-50 text-slate-400'
                        : txn.paymentsForFlat > 1
                          ? 'bg-amber-50/70'
                          : 'hover:bg-slate-50'
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums">
                      {new Date(txn.txnDate).toLocaleDateString('mn-MN')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                      {formatMnt(txn.amount)}
                    </td>
                    <td className="max-w-md px-3 py-2">
                      <span className="block truncate text-xs" title={txn.description}>
                        {txn.description}
                      </span>
                      {txn.reason && !txn.isDuplicate && (
                        <span className="block text-[11px] text-amber-700">{txn.reason}</span>
                      )}
                      {txn.overpayAmount !== null && (
                        <span className="block text-[11px] text-blue-700">
                          Илүү төлөлт: {formatMnt(txn.overpayAmount)}
                        </span>
                      )}
                      {!txn.isDuplicate && txn.paymentsForFlat > 1 && (
                        <span className="block text-[11px] font-medium text-amber-700">
                          {txn.flatNumber} тоот энэ хуулгад {txn.paymentsForFlat} удаа төлсөн
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {txn.isDuplicate ? (
                        <span className="text-xs">давхардсан</span>
                      ) : txn.flatNumber ? (
                        <span className="font-semibold tabular-nums text-emerald-700">
                          {txn.flatNumber}
                          <span className="ml-1 text-[10px] font-normal text-slate-400">
                            {txn.confidence}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-700">гар шалгалт</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                // Данс нь мөнгө хаашаа орохыг шийддэг тул ЗААВАЛ баталгаажуулна
                if (
                  !confirm(
                    `«${preview.account.displayName}» данс руу ${newRows} гүйлгээ бүртгэх үү?\n\n` +
                      'Буруу данс сонгосон бол төлбөр буруу ангилалд орно.',
                  )
                ) {
                  return;
                }
                send('commit');
              }}
              disabled={busy !== null || newRows === 0}
              className="rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === 'commit'
                ? 'Бүртгэж байна…'
                : newRows === 0
                  ? 'Бүртгэх шинэ гүйлгээ алга'
                  : `«${preview.account.displayName}» данс руу ${newRows} гүйлгээ бүртгэх`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Болих
            </button>
          </div>
        </div>
        );
      })()}

      {/* ── 3. Дүн ────────────────────────────────────────────────────────── */}
      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold text-emerald-900">✓ Бүртгэгдлээ</h2>
          <dl className="mt-3 space-y-1 text-sm text-emerald-900">
            <div className="flex justify-between">
              <dt>Шинээр бүртгэсэн гүйлгээ</dt>
              <dd className="font-bold tabular-nums">{result.imported}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Автоматаар хуваарилсан</dt>
              <dd className="font-bold tabular-nums">{result.autoMatched}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Гар шалгалт хүлээж байгаа</dt>
              <dd className="font-bold tabular-nums">{result.needsReview}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Давхардсан тул алгассан</dt>
              <dd className="font-bold tabular-nums">{result.duplicatesSkipped}</dd>
            </div>
          </dl>
          {result.needsReview > 0 && (
            <p className="mt-3 text-sm text-emerald-900">
              ↓ Доорх «Гар шалгалт» хэсэгт тэдгээрийг айлд оноож болно.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              reset();
              setRows(null);
              setFileName(null);
            }}
            className="mt-4 rounded-lg border border-emerald-300 bg-white px-5 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            Дараагийн файл
          </button>
        </div>
      )}
    </div>
  );
}
