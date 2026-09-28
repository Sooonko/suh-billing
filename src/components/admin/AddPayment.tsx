'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMnt } from '@/lib/format';
import { CATEGORIES, type BillCategory } from '@/lib/types';

/**
 * Төлбөрийг ГАРААР бүртгэх.
 *
 * ЯАГААД ХЭРЭГТЭЙ: бүх данс банкны хуулгаар ордоггүй. СӨХ-ийн дансанд
 * оршин суугчийн төлбөрөөс гадна зогсоол, дотоод шилжүүлэг их
 * холилддог тул түүнийг импортлохгүй гараар бүртгэхээр шийдсэн. Мөн
 * бэлнээр төлсөн, хуулгаас унасан төлбөр үргэлж гардаг.
 *
 * ⚠️ Тухайн ангиллын хуулгыг ХОЖИМ импортлох бол энд бүртгэхгүй —
 * ижил төлбөр хоёр удаа тоологдоно. Маягт дээр үүнийг сануулна.
 */

const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none transition focus:border-slate-900';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Өнөөдөр — 'YYYY-MM-DD' */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddPayment({ defaultCategory }: { defaultCategory?: BillCategory }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [flatNumber, setFlatNumber] = useState('');
  const [category, setCategory] = useState<BillCategory>(defaultCategory ?? 'SOH');
  const [amount, setAmount] = useState('');
  const [txnDate, setTxnDate] = useState(today());
  const [note, setNote] = useState('');

  function close() {
    setOpen(false);
    setError(null);
    setFlatNumber('');
    setAmount('');
    setNote('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const response = await fetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flatNumber: Number(flatNumber),
        category,
        amount: Number(amount),
        txnDate,
        note: note || null,
      }),
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? 'Алдаа гарлаа');
      return;
    }
    setDone(`${data.flatNumber} тоот · ${formatMnt(data.amount)} бүртгэгдлээ`);
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setDone(null);
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <span aria-hidden className="text-base leading-none">＋</span>
          Төлбөр нэмэх
        </button>
        {done && <p className="text-xs font-medium text-emerald-700">{done}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-xl border border-slate-300 bg-slate-50 p-4 text-left shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-slate-900">Төлбөрийг гараар бүртгэх</p>
        <button
          type="button"
          onClick={close}
          className="text-sm text-slate-500 underline decoration-slate-300 hover:text-slate-900"
        >
          Хаах
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Тоот">
          <input
            required
            autoFocus
            inputMode="numeric"
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            placeholder="236"
            className={INPUT}
          />
        </Field>

        <Field label="Ангилал">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BillCategory)}
            className={INPUT}
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Дүн (₮)">
          <input
            required
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="35000"
            className={INPUT}
          />
        </Field>

        <Field label="Огноо">
          <input
            required
            type="date"
            value={txnDate}
            onChange={(e) => setTxnDate(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Тэмдэглэл">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="бэлнээр"
            className={INPUT}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Бүртгэж байна…' : 'Бүртгэх'}
        </button>
        <p className="text-xs text-slate-500">
          ⚠️ Энэ ангиллын банкны хуулгыг хожим оруулах бол энд бүртгэхгүй — ижил төлбөр хоёр удаа
          тоологдоно.
        </p>
      </div>
    </form>
  );
}
