'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BUTTON, Field, INPUT, Modal, ModalError, Spinner } from '@/components/ui/Modal';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import { callApi } from '@/lib/api-client';
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

const SMALL =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50';

export function PaymentActions({ txn }: { txn: PaymentActionTxn }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Оноолтыг буцаана — гүйлгээ үлдэж, дахин оноох боломжтой болно */
  async function undo() {
    await confirm({
      title: 'Оноолтыг буцаах уу?',
      message: 'Гүйлгээ хэвээр үлдэнэ — зөвхөн айлд оногдсон нь цуцлагдаж, дахин оноох боломжтой болно.',
      quote: txn.description,
      details: [
        ['Огноо', new Date(txn.txnDate).toLocaleDateString('mn-MN')],
        ['Дүн', formatMnt(txn.amount)],
      ],
      confirmLabel: 'Буцаах',
      tone: 'danger',
      action: async () => {
        for (const id of txn.allocationIds) {
          const result = await callApi(`/api/admin/allocations?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          if (!result.ok) {
            // Хэсэгчлэн буцсан байж болзошгүй — жагсаалтыг шинэчилж бодит төлвийг харуулна
            router.refresh();
            return result.error;
          }
        }
        toast('Оноолт буцаагдлаа');
        router.refresh();
      },
    });
  }

  /** Оршин суугчийн төлбөр биш — айлын өрд тооцохгүй */
  async function ignore() {
    await confirm({
      title: 'Айлын өрд тооцохгүй болгох уу?',
      message: 'Гүйлгээ устахгүй — зүгээр л ямар ч айлд оногдохгүй. Хүссэн үедээ «Буцаах» дарж сэргээнэ.',
      quote: txn.description,
      details: [
        ['Огноо', new Date(txn.txnDate).toLocaleDateString('mn-MN')],
        ['Дүн', formatMnt(txn.amount)],
      ],
      confirmLabel: 'Тооцохгүй',
      action: async () => {
        const result = await callApi('/api/admin/reconcile/ignore', {
          method: 'POST',
          json: { id: txn.id, ignored: true },
        });
        if (!result.ok) return result.error;
        toast('Тооцохгүй болголоо');
        router.refresh();
      },
    });
  }

  async function unignore() {
    setBusy(true);
    const result = await callApi('/api/admin/reconcile/ignore', {
      method: 'POST',
      json: { id: txn.id, ignored: false },
    });
    setBusy(false);
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast('Гүйлгээг буцаан идэвхжүүллээ');
    router.refresh();
  }

  if (txn.status === 'IGNORED') {
    return (
      <button type="button" onClick={unignore} disabled={busy} className={SMALL}>
        {busy ? '…' : 'Буцаах'}
      </button>
    );
  }

  if (txn.status === 'MATCHED') {
    return (
      <button type="button" onClick={undo} className={SMALL}>
        Засах
      </button>
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
        <button type="button" onClick={ignore} className={SMALL}>
          Тооцохгүй
        </button>
      </div>
      {/* Хаагдахад маягтын төлөв цэвэрлэгдэхийн тулд нээлттэй үед л зурна */}
      {open && <AllocateDialog txn={txn} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Оноох цонх */
function AllocateDialog({ txn, onClose }: { txn: PaymentActionTxn; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flatNumber, setFlatNumber] = useState(
    txn.parsed_flat_number === null ? '' : String(txn.parsed_flat_number),
  );
  const [category, setCategory] = useState<BillCategory>(txn.source_category);
  const [amount, setAmount] = useState(String(txn.remaining > 0 ? txn.remaining : txn.amount));

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
    const result = await callApi('/api/admin/allocations', {
      method: 'POST',
      // API нь олон айлд хуваах боломжтой тул items массив хүлээж авдаг
      json: { transactionId: txn.id, items: [{ flatNumber: flat, category, amount: value }] },
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(`${flat} тоотод ${formatMnt(value)} оноолоо`);
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      title="Төлбөр оноох"
      description={
        <>
          {new Date(txn.txnDate).toLocaleDateString('mn-MN')} ·{' '}
          <span className="font-semibold text-slate-900">{formatMnt(txn.amount)}</span>
        </>
      }
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BUTTON.secondary}>
            Болих
          </button>
          <button type="submit" disabled={busy} className={BUTTON.primary}>
            {busy && <Spinner />}
            {busy ? 'Хадгалж байна…' : 'Оноох'}
          </button>
        </>
      }
    >
      {/* Гүйлгээний утга — тоот аль нь болохыг эндээс уншина */}
      <p className="mb-4 wrap-break-word rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {txn.description}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Тоот">
          <input
            required
            data-autofocus
            inputMode="numeric"
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            placeholder="107"
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
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      {txn.remaining !== txn.amount && (
        <p className="mt-2 text-xs text-slate-500">
          Хуваарилагдаагүй үлдэгдэл: <b className="tabular-nums">{formatMnt(txn.remaining)}</b>
        </p>
      )}

      <ModalError>{error}</ModalError>
    </Modal>
  );
}
