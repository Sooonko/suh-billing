'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BUTTON, Field, INPUT, Modal, ModalError, Spinner } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Feedback';
import { callApi } from '@/lib/api-client';
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

/** Өнөөдөр — 'YYYY-MM-DD', ХЭРЭГЛЭГЧИЙН цагийн бүсээр (UTC биш) */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AddPayment({ defaultCategory }: { defaultCategory?: BillCategory }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <span aria-hidden className="text-base leading-none">＋</span>
        Төлбөр нэмэх
      </button>
      {/* Хаагдахад маягт цэвэрлэгдэхийн тулд нээлттэй үед л зурна */}
      {open && <AddPaymentDialog defaultCategory={defaultCategory} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddPaymentDialog({
  defaultCategory,
  onClose,
}: {
  defaultCategory?: BillCategory;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [flatNumber, setFlatNumber] = useState('');
  const [category, setCategory] = useState<BillCategory>(defaultCategory ?? 'SOH');
  const [amount, setAmount] = useState('');
  const [txnDate, setTxnDate] = useState(today);
  const [note, setNote] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const flat = Number(flatNumber.trim());
    if (!Number.isInteger(flat) || flat <= 0) {
      setError('Тоотоо зөв оруулна уу');
      return;
    }
    // «35,000» гэж таслалтай бичсэнийг ч хүлээж авна
    const value = Number(amount.replace(/[,\s₮]/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Дүн буруу байна');
      return;
    }

    setBusy(true);
    setError(null);
    const result = await callApi<{ flatNumber: number; amount: number }>('/api/admin/payments', {
      method: 'POST',
      json: { flatNumber: flat, category, amount: value, txnDate, note: note.trim() || null },
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(`${result.data.flatNumber ?? flat} тоот · ${formatMnt(result.data.amount ?? value)} бүртгэгдлээ`);
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      title="Төлбөр гараар бүртгэх"
      description="Бэлнээр төлсөн, эсвэл хуулгаас унасан төлбөр"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BUTTON.secondary}>
            Болих
          </button>
          <button type="submit" disabled={busy} className={BUTTON.primary}>
            {busy && <Spinner />}
            {busy ? 'Бүртгэж байна…' : 'Бүртгэх'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Тоот">
          <input
            required
            data-autofocus
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

        <div className="sm:col-span-2">
          <Field label="Тэмдэглэл">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="бэлнээр"
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      <p className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
        <span aria-hidden>⚠️</span>
        <span>
          Энэ ангиллын банкны хуулгыг хожим оруулах бол энд бүртгэхгүй — ижил төлбөр хоёр удаа
          тоологдоно.
        </span>
      </p>

      <ModalError>{error}</ModalError>
    </Modal>
  );
}
