'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBillingMonth, formatMnt } from '@/lib/format';
import { CATEGORY_LABEL, type BillCategory } from '@/lib/types';

/**
 * Нэхэмжлэл устгах — баталгаажуулах цонхтой.
 *
 * ЯАГААД ЦОНХ ХЭРЭГТЭЙ ВЭ:
 * Нэхэмжлэл устгахад тэр айлын ӨР БУУРНА. Хэрэв тэр сард төлбөр
 * оногдсон байсан бол илүү төлөлт болж хувирна. Нэг дарахад буцаах
 * боломжгүй зүйл болох тул юу устахыг ТОДОРХОЙ харуулж баталгаажуулна.
 *
 * `confirm()` биш жинхэнэ цонх хэрэглэсэн шалтгаан: тоот, сар, дүнг
 * уншихад ойлгомжтой байхаар харуулах хэрэгтэй.
 */
export function DeleteInvoiceButton({
  id,
  flatNumber,
  category,
  billingMonth,
  billAmount,
}: {
  id: string;
  flatNumber: number;
  category: BillCategory;
  billingMonth: string;
  billAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function remove() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/invoices?id=${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? 'Устгахад алдаа гарлаа');
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Нэхэмжлэл устгах"
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
      >
        Устгах
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Нэхэмжлэл устгах"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-5 text-left shadow-xl"
          >
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Нэхэмжлэлийг устгах уу?
            </h2>

            <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {[
                ['Тоот', String(flatNumber)],
                ['Ангилал', CATEGORY_LABEL[category]],
                ['Сар', formatBillingMonth(billingMonth)],
                ['Нэхэмжилсэн дүн', formatMnt(billAmount)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2">
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 flex gap-2 text-xs leading-relaxed text-amber-900">
              <span aria-hidden>⚠️</span>
              <span>
                Устгавал тэр айлын өр <b>{formatMnt(billAmount)}</b>-өөр буурна. Хэрэв энэ сард
                төлбөр оногдсон бол илүү төлөлт болж харагдана. Буцаах боломжгүй.
              </span>
            </p>

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-lg bg-red-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {busy ? 'Устгаж байна…' : 'Устгах'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Болих
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
