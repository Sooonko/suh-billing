'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMnt } from '@/lib/format';
import { CATEGORIES, CATEGORY_LABEL, type BillCategory } from '@/lib/types';

/**
 * Гар шалгалт хүлээж байгаа гүйлгээнүүд.
 *
 * Хоёр тохиолдолд ирнэ:
 *  1. Гүйлгээний утгаас тоот танигдаагүй (эсвэл 2+ тоот тохирсон)
 *  2. Хэсэгчлэн хуваарилсан — үлдэгдэлтэй
 *
 * ⚠️ Жагсаалт нь БҮХ ангиллын гүйлгээг агуулна — усны хуулга импортлож
 * байхад доор цахилгааны хуучин гүйлгээ ч харагдана. Тиймээс мөр бүрт
 * ангиллын шошго ЗААВАЛ харуулна, эс бөгөөс админ буруу ангилалд оноож
 * магадгүй.
 *
 * Оноосны дараа trigger нь гүйлгээний status-ыг өөрөө шинэчилнэ, үлдэгдэл
 * нь Σнэхэмжлэл − Σхуваарилалт томьёогоор аяндаа залруулагдана.
 */

/** Ангилал бүрийн өнгө — нэг харцаар ялгахад */
const CATEGORY_STYLE: Record<BillCategory, string> = {
  WATER_HEAT: 'bg-sky-100 text-sky-900 ring-sky-600/20',
  SOH: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  ELECTRICITY: 'bg-amber-100 text-amber-900 ring-amber-600/20',
};

export interface PendingTxn {
  id: string;
  txn_date: string;
  amount: number;
  remaining: number;
  description: string;
  source_category: BillCategory;
  parsed_flat_number: number | null;
  review_reason: string | null;
  status: string;
}

function Row({ txn }: { txn: PendingTxn }) {
  const router = useRouter();
  const [flatNumber, setFlatNumber] = useState('');
  const [category, setCategory] = useState<BillCategory>(txn.source_category);
  const [amount, setAmount] = useState(String(txn.remaining));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * «Тооцохгүй» болгох — оршин суугчийн төлбөр БИШ орлого.
   *
   * СӨХ-ийн данс руу зогсоолын түрээс, дотоод шилжүүлэг гэх мэт өөр
   * орлого ордог. Гүйлгээг УСТГАХГҮЙ: банкинд мөнгө үнэхээр орсон тул
   * баримт үлдэх ёстой, зүгээр л ямар ч айлын өрд тооцохгүй.
   */
  async function ignore() {
    if (!confirm(`${formatMnt(txn.amount)} гүйлгээг айлын өрд ТООЦОХГҮЙ болгох уу?\n\n«${txn.description}»\n\nГүйлгээ устахгүй — зүгээр л ямар ч айлд оногдохгүй болно.`)) return;
    setBusy(true);
    setError(null);

    const response = await fetch('/api/admin/reconcile/ignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: txn.id, ignored: true }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? 'Алдаа гарлаа');
      return;
    }
    router.refresh();
  }

  async function allocate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

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

    setBusy(true);
    const response = await fetch('/api/admin/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: txn.id,
        items: [{ flatNumber: flat, category, amount: value }],
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? 'Хуваарилахад алдаа гарлаа');
      return;
    }
    router.refresh();
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Ямар данснаас ирсэн гүйлгээ вэ — буруу ангилалд оноохоос сэргийлнэ */}
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
            CATEGORY_STYLE[txn.source_category] ?? CATEGORY_STYLE.SOH
          }`}
        >
          {CATEGORY_LABEL[txn.source_category] ?? txn.source_category}
        </span>
        <span className="text-xs tabular-nums text-slate-400">
          {new Date(txn.txn_date).toLocaleDateString('mn-MN')}
        </span>
        <span className="text-lg font-bold tabular-nums text-slate-900">{formatMnt(txn.amount)}</span>
        {txn.remaining !== txn.amount && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
            үлдсэн {formatMnt(txn.remaining)}
          </span>
        )}
        <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {txn.status}
        </span>
      </div>

      <p className="mb-1 break-words text-sm text-slate-700">{txn.description}</p>

      {txn.review_reason && (
        <p className="mb-3 text-xs text-amber-700">⚠️ {txn.review_reason}</p>
      )}
      {txn.parsed_flat_number !== null && (
        <p className="mb-3 text-xs text-slate-500">
          Системийн таамаг:{' '}
          <button
            type="button"
            onClick={() => setFlatNumber(String(txn.parsed_flat_number))}
            className="font-semibold text-slate-900 underline decoration-slate-300"
          >
            {txn.parsed_flat_number}
          </button>
        </p>
      )}

      <form onSubmit={allocate} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Тоот</label>
          <input
            inputMode="numeric"
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            placeholder="236"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Ангилал</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BillCategory)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            {CATEGORIES.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Дүн</label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-slate-900"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? '…' : 'Оноох'}
        </button>

        {/* Оршин суугчийн төлбөр биш орлогыг эндээс хасна */}
        <button
          type="button"
          onClick={ignore}
          disabled={busy}
          title="Айлын өрд тооцохгүй болгоно. Гүйлгээ устахгүй."
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          Тооцохгүй
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

export function PendingAllocations({
  transactions,
  emptyMessage = 'Гар шалгалт хүлээж байгаа гүйлгээ байхгүй',
}: {
  transactions: PendingTxn[];
  emptyMessage?: string;
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
        <p aria-hidden className="text-2xl">
          ✅
        </p>
        <p className="mt-2 text-sm font-medium text-slate-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {transactions.map((txn) => (
        <Row key={txn.id} txn={txn} />
      ))}
    </ul>
  );
}
