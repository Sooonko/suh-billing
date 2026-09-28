'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatBillingMonth, formatMnt } from '@/lib/format';
import { CATEGORY_LABEL, type BillCategory } from '@/lib/types';

/**
 * Нэхэмжлэлийг ГАРААР нэмэх.
 *
 * ЯАГААД: Excel-д мөр нь байхгүй, эсвэл заалт дутуу тул орж ирээгүй айл
 * бүтэн сараар нэхэмжлэлгүй үлддэг. Бүхэл файлыг дахин импорт хийлгүйгээр
 * ганц айлыг нэмэх гарц байх ёстой.
 *
 * ⚠️ Дүнг админ бичихгүй — ЗААЛТЫГ л өгнө, системд бодуулна. Ингэснээр
 * гараар нэмсэн нэхэмжлэл импортоор орсонтой ЯГ ижил дүрмээр бодогдоно.
 * (СӨХ нь тоолуургүй тул тэнд л дүнг шууд бичнэ.)
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

export function AddInvoice({
  category,
  month: defaultMonth,
}: {
  category: BillCategory;
  /** Шүүлтүүрийн сар — маягтын анхдагч утга болно */
  month: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  /**
   * Сарыг маягт дотроо ЗАСАЖ болно.
   *
   * ЯАГААД: шүүлтүүрийн сарын цэс нь нэхэмжлэл АЛЬ ХЭДИЙН байгаа
   * саруудыг л харуулдаг. Тиймээс 6, 7 сар шиг огт нэхэмжлэлгүй сард
   * мөр нэмэх гарц байхгүй байв — тэр сар цэсэнд гарч ирдэггүй.
   */
  const [month, setMonth] = useState(defaultMonth);
  const [flatNumber, setFlatNumber] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  function close() {
    setOpen(false);
    setError(null);
    setFlatNumber('');
    setValues({});
    setNote('');
    // Сарыг шүүлтүүрийн утга руу нь буцаана — дараагийн нэмэлт нь
    // тэр сараас эхлэх нь хамгийн түгээмэл хэрэгцээ
    setMonth(defaultMonth);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const num = (key: string) => (values[key] === undefined || values[key] === '' ? 0 : Number(values[key]));

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      setError('Сарыг зөв сонгоно уу');
      setBusy(false);
      return;
    }

    const response = await fetch('/api/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        billingMonth: month,
        flatNumber: Number(flatNumber),
        note: note || null,
        ...(category === 'WATER_HEAT'
          ? {
              hotPrev: num('hotPrev'),
              hotCurrent: num('hotCurrent'),
              coldPrev: num('coldPrev'),
              coldCurrent: num('coldCurrent'),
            }
          : category === 'ELECTRICITY'
            ? { prevReading: num('prev'), currentReading: num('current') }
            : { billAmount: num('amount') }),
      }),
    });

    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? 'Алдаа гарлаа');
      return;
    }

    setDone(`${data.flatNumber} тоот — ${formatMnt(data.billAmount)} нэмэгдлээ`);
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

          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden className="text-base leading-none">＋</span>
          Нэхэмжлэл нэмэх
        </button>
        {done && <p className="text-xs font-medium text-emerald-700">{done}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full text-left rounded-xl border border-slate-300 bg-slate-50 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-slate-900">
          {CATEGORY_LABEL[category]} — нэхэмжлэл нэмэх
        </p>
        <button
          type="button"
          onClick={close}
          className="text-sm text-slate-500 underline decoration-slate-300 hover:text-slate-900"
        >
          Хаах
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Сар">
          <input
            required
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Тоот">
          <input
            required
            autoFocus
            inputMode="numeric"
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            placeholder="109"
            className={INPUT}
          />
        </Field>

        {category === 'WATER_HEAT' && (
          <>
            <Field label="Халуун өмнөх">
              <input inputMode="decimal" value={values.hotPrev ?? ''} onChange={set('hotPrev')} className={INPUT} />
            </Field>
            <Field label="Халуун одоо">
              <input inputMode="decimal" value={values.hotCurrent ?? ''} onChange={set('hotCurrent')} className={INPUT} />
            </Field>
            <Field label="Хүйтэн өмнөх">
              <input inputMode="decimal" value={values.coldPrev ?? ''} onChange={set('coldPrev')} className={INPUT} />
            </Field>
            <Field label="Хүйтэн одоо">
              <input inputMode="decimal" value={values.coldCurrent ?? ''} onChange={set('coldCurrent')} className={INPUT} />
            </Field>
          </>
        )}

        {category === 'ELECTRICITY' && (
          <>
            <Field label="Өмнөх заалт">
              <input inputMode="decimal" value={values.prev ?? ''} onChange={set('prev')} className={INPUT} />
            </Field>
            <Field label="Одоогийн заалт">
              <input inputMode="decimal" value={values.current ?? ''} onChange={set('current')} className={INPUT} />
            </Field>
          </>
        )}

        {category === 'SOH' && (
          <Field label="Дүн (₮)">
            <input required inputMode="numeric" value={values.amount ?? ''} onChange={set('amount')} className={INPUT} />
          </Field>
        )}

        <Field label="Тэмдэглэл">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Excel-д байгаагүй"
            className={INPUT}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Нэмж байна…' : 'Нэмэх'}
        </button>
        <p className="text-xs text-slate-500">
          {category === 'SOH'
            ? 'СӨХ нь тоолуургүй тул дүнг шууд бичнэ.'
            : 'Дүнг систем заалтаас бодно — импортоор орсонтой ижил дүрмээр.'}
        </p>
      </div>
    </form>
  );
}
