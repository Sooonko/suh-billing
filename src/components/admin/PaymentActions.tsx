'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatMnt } from '@/lib/format';
import { CATEGORIES, type BillCategory } from '@/lib/types';

/**
 * Гүйлгээний мөрөн дээрх үйлдлүүд.
 *
 * ЯАГААД НЭГ ЖАГСААЛТАД ОРУУЛСАН БЭ:
 * Өмнө нь «Дансны хуулга» (сайн шүүлттэй, үйлдэлгүй) ба «Тулгалт»
 * (үйлдэлтэй, шүүлтгүй) гэсэн ХОЁР хуудас ижил жагсаалтыг харуулдаг
 * байв. Шинэ хүн хараад «нэг дээр нь засаж болдог, нөгөө дээр нь
 * болдоггүй» гэж ойлгохгүй байсан. Одоо нэг жагсаалт, мөр бүр дээрээ
 * үйлдэлтэй.
 *
 * Үйлдэл нь ТӨЛВӨӨС хамаарна — админд хэрэггүй товч харуулахгүй:
 *   хуваарилаагүй / дутуу → оноох маягт + тооцохгүй
 *   хуваарилсан          → засах (оноолтыг буцаана)
 *   тооцохгүй            → буцаах
 */

export interface PaymentActionTxn {
  id: string;
  txnDate: string;
  amount: number;
  /** Хуваарилагдсаны дараах үлдэгдэл — оноох маягтын анхдагч дүн */
  remaining: number;
  status: string;
  source_category: BillCategory;
  parsed_flat_number: number | null;
  description: string;
  /** Буцаахад устгах хуваарилалтууд */
  allocationIds: string[];
}

export function PaymentActions({ txn }: { txn: PaymentActionTxn }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [flatNumber, setFlatNumber] = useState(
    txn.parsed_flat_number === null ? '' : String(txn.parsed_flat_number),
  );
  const [category, setCategory] = useState<BillCategory>(txn.source_category);
  const [amount, setAmount] = useState(String(txn.remaining || txn.amount));

  async function send(url: string, init: RequestInit, onOk?: () => void) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? 'Алдаа гарлаа');
      return false;
    }
    onOk?.();
    router.refresh();
    return true;
  }

  /** Оноолтыг буцаана — гүйлгээ үлдэж, дахин оноох боломжтой болно */
  async function undo() {
    if (
      !confirm(
        `${formatMnt(txn.amount)} гүйлгээний оноолтыг буцаах уу?\n\n«${txn.description}»\n\nГүйлгээ хэвээр үлдэнэ — зөвхөн айлд оногдсон нь цуцлагдана.`,
      )
    )
      return;
    for (const id of txn.allocationIds) {
      const ok = await send(`/api/admin/allocations?id=${id}`, { method: 'DELETE' });
      if (!ok) return;
    }
  }

  /** Оршин суугчийн төлбөр биш — айлын өрд тооцохгүй */
  async function ignore() {
    if (
      !confirm(
        `${formatMnt(txn.amount)} гүйлгээг айлын өрд ТООЦОХГҮЙ болгох уу?\n\n«${txn.description}»\n\nГүйлгээ устахгүй — зүгээр л ямар ч айлд оногдохгүй болно.`,
      )
    )
      return;
    await send('/api/admin/reconcile/ignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: txn.id, ignored: true }),
    });
  }

  async function unignore() {
    await send('/api/admin/reconcile/ignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: txn.id, ignored: false }),
    });
  }

  async function allocate(event: React.FormEvent) {
    event.preventDefault();
    const flat = Number(flatNumber);
    if (!Number.isInteger(flat) || flat <= 0) {
      setError('Тоотоо зөв оруулна уу');
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Дүн буруу байна');
      return;
    }
    await send(
      '/api/admin/allocations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // API нь олон айлд хуваах боломжтой тул items массив хүлээж авдаг
        body: JSON.stringify({
          transactionId: txn.id,
          items: [{ flatNumber: flat, category, amount: value }],
        }),
      },
      () => setOpen(false),
    );
  }

  const small =
    'rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50';

  if (txn.status === 'IGNORED') {
    return (
      <button type="button" onClick={unignore} disabled={busy} className={small}>
        {busy ? '…' : 'Буцаах'}
      </button>
    );
  }

  if (txn.status === 'MATCHED') {
    return (
      <div className="text-right">
        <button type="button" onClick={undo} disabled={busy} className={small}>
          {busy ? '…' : 'Засах'}
        </button>
        {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
      </div>
    );
  }

  // Хуваарилаагүй / дутуу — оноох ажил.
  // Маягтыг МӨРӨНД шахахгүй: 3 талбар + 2 товч нь хүснэгтийн нүдэнд
  // багтахгүй, мөр хоёр эгнээ болж эвдэрдэг. Тусдаа цонхонд гаргавал
  // гүйлгээний утга бүтнээрээ харагдаж, юу оноож байгаа нь тодорхой.
  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          Оноох
        </button>
        <button type="button" onClick={ignore} disabled={busy} className={small}>
          Тооцохгүй
        </button>
      </div>
      {open && (
        <AllocateDialog
          txn={txn}
          flatNumber={flatNumber}
          setFlatNumber={setFlatNumber}
          category={category}
          setCategory={setCategory}
          amount={amount}
          setAmount={setAmount}
          busy={busy}
          error={error}
          onSubmit={allocate}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Оноох цонх.
 *
 * Дэлгэцийн голд гарна. Esc дарах, гадуур дарахад хаагдана — хэрэглэгч
 * «яаж гарах вэ» гэж хайхгүй.
 */
function AllocateDialog({
  txn,
  flatNumber,
  setFlatNumber,
  category,
  setCategory,
  amount,
  setAmount,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  txn: PaymentActionTxn;
  flatNumber: string;
  setFlatNumber: (v: string) => void;
  category: BillCategory;
  setCategory: (v: BillCategory) => void;
  amount: string;
  setAmount: (v: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const input =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none transition focus:border-slate-900';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Төлбөр оноох"
        // Дотор нь дарахад цонх хаагдахаас сэргийлнэ
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-5 text-left shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Төлбөр оноох</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {new Date(txn.txnDate).toLocaleDateString('mn-MN')} ·{' '}
              <span className="font-semibold text-slate-900">{formatMnt(txn.amount)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          >
            ✕
          </button>
        </div>

        {/* Гүйлгээний утга — тоот аль нь болохыг эндээс уншина */}
        <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {txn.description}
        </p>

        <form onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Тоот
              </span>
              <input
                ref={firstField}
                required
                inputMode="numeric"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                placeholder="107"
                className={input}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Ангилал
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BillCategory)}
                className={input}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Дүн
              </span>
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={input}
              />
            </label>
          </div>

          {txn.remaining !== txn.amount && (
            <p className="mt-2 text-xs text-slate-500">
              Хуваарилагдаагүй үлдэгдэл: {formatMnt(txn.remaining)}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Хадгалж байна…' : 'Хадгалах'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Болих
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
