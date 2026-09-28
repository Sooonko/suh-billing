'use client';

import { useState } from 'react';
import { formatMnt } from '@/lib/format';
import { hasDebt } from '@/lib/money';
import { buildPaymentReference } from '@/lib/payment-reference';
import type { BillCategory } from '@/lib/types';

/**
 * «Төлбөр төлөх» хэсэг — данс, дүн, гүйлгээний утга гурвыг бэлэн өгнө.
 *
 * ЯАГААД ГҮЙЛГЭЭНИЙ УТГА ХАМГИЙН ЧУХАЛ ВЭ:
 * Бүх автомат тулгалт түүнээс эхэлдэг. Оршин суугч дураараа бичвэл
 * төлбөр нь гар шалгалт руу унаж, хэдэн өдрөөр бүртгэгдэхгүй байж
 * магадгүй. Тиймээс утгыг хамгийн тод, хамгийн том товчтой харуулж,
 * заавал хуулахыг сануулна.
 *
 * Дүнг ч хуулж болдог болгосон — гар утсан дээр 6 оронтой тоог гараар
 * шивэхэд андуурахад хялбар.
 */

/** "MN110015001175205621" → "MN11 0015 0011 7520 5621" */
function groupIban(value: string): string {
  return value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

function CopyRow({
  label,
  shown,
  copied,
  hint,
  emphasis,
}: {
  label: string;
  /** Дэлгэцэнд харагдах хэлбэр (зайтай, тэмдэгттэй) */
  shown: string;
  /** Хуулах ЖИНХЭНЭ утга — банкинд зайтай хуулбал буруу болно */
  copied: string;
  hint?: string;
  emphasis?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'done' | 'fail'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(copied);
      setState('done');
    } catch {
      setState('fail');
    }
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        emphasis ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            emphasis ? 'text-amber-800' : 'text-slate-400'
          }`}
        >
          {label}
        </p>
        <p
          className={`mt-0.5 break-words font-bold tabular-nums ${
            emphasis ? 'text-amber-950' : 'text-slate-900'
          }`}
        >
          {shown}
        </p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>

      <button
        type="button"
        onClick={copy}
        aria-label={`${label} хуулах`}
        className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition active:scale-95 ${
          emphasis
            ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        {state === 'done' ? '✓ Хуулсан' : state === 'fail' ? 'Болсонгүй' : 'Хуулах'}
      </button>
    </div>
  );
}

export function PayPanel({
  flatNumber,
  category,
  categoryLabel,
  amount,
  month,
  accountNumber,
  accountName,
}: {
  flatNumber: number;
  category: BillCategory;
  categoryLabel: string;
  /** Төлөх дүн. 0 буюу сөрөг бол товч огт гарахгүй. */
  amount: number;
  month: string | null;
  accountNumber: string | null;
  accountName: string | null;
}) {
  const [open, setOpen] = useState(false);

  // Өргүй, илүү төлсөн, эсвэл 50₮-өөс бага үлдэгдэлтэй бол төлөх зүйл алга.
  // Сүүлийнх нь аравтын бөөрөнхийллийн үлдэц — оршин суугч түүнийг
  // шилжүүлэх боломжгүй тул товч гаргах нь төөрөгдөл (money.ts).
  if (!hasDebt(amount)) return null;
  // Данс бүртгэгдээгүй бол хуурамч заавар өгөхгүй
  if (!accountNumber) return null;

  const reference = buildPaymentReference(flatNumber, category, month);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]"
      >
        Төлбөр төлөх · {formatMnt(amount)}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-slate-900">
          {categoryLabel} · {flatNumber} тоот
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 underline decoration-slate-300 hover:text-slate-900"
        >
          Хаах
        </button>
      </div>

      <div className="space-y-2">
        <CopyRow
          label="Данс"
          shown={groupIban(accountNumber)}
          // Банк руу ЗАЙГҮЙ дугаар очно — зайтай хуулбал хүлээж авахгүй
          copied={accountNumber}
          hint={accountName ?? undefined}
        />
        <CopyRow label="Дүн" shown={formatMnt(amount)} copied={String(Math.round(amount))} />
        <CopyRow
          label="Гүйлгээний утга"
          shown={reference}
          copied={reference}
          emphasis
          hint="Үүнийг заавал хуулж тавина уу"
        />
      </div>

      <p className="mt-2.5 flex gap-2 text-xs leading-relaxed text-slate-500">
        <span aria-hidden>⚠️</span>
        <span>
          Гүйлгээний утгыг өөрчилвөл төлбөр тань автоматаар бүртгэгдэхгүй, 1–2 хоног
          хожимдож болзошгүй.
        </span>
      </p>
    </div>
  );
}
