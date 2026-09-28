'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

  // Хуваарилаагүй / дутуу — оноох ажил
  if (!open) {
    return (
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
    );
  }

  return (
    <form onSubmit={allocate} className="flex flex-wrap items-center justify-end gap-1.5">
      <input
        autoFocus
        inputMode="numeric"
        value={flatNumber}
        onChange={(e) => setFlatNumber(e.target.value)}
        placeholder="тоот"
        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs tabular-nums outline-none focus:border-slate-900"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as BillCategory)}
        className="rounded-lg border border-slate-300 px-1.5 py-1 text-xs outline-none focus:border-slate-900"
      >
        {CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs tabular-nums outline-none focus:border-slate-900"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? '…' : 'Хадгалах'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={small}>
        Болих
      </button>
      {error && <p className="w-full text-right text-[11px] text-red-600">{error}</p>}
    </form>
  );
}
