'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatMnt, previousMonth, shortMonth } from '@/lib/format';
import { DeleteInvoiceButton } from './DeleteInvoiceButton';
import type { BillCategory } from '@/lib/types';

/**
 * Нэхэмжлэлийн жагсаалт — заалт засах.
 *
 * Хүснэгтийн бүтэц нь СӨХ-ийн Excel-тэй ЗОРИУД адил: тоолуур бүрийн өмнөх
 * ба энэ сарын заалт тусдаа багана, хажууд нь зөрүү. Ингэснээр админ
 * хоёрыг зэрэгцүүлж шалгахад хялбар.
 *
 * ⚠️ Ус дулаанд ДҮНГ гараар засахгүй, зөвхөн ЗААЛТЫГ. Дүнг систем дахин
 * бодно. Эс бөгөөс Excel дээрх «нэг нүдийг гараар засчихсан» асуудал
 * буцаж ирнэ — тоот 129 шиг.
 */

export interface InvoiceRow {
  id: string;
  flat_number: number;
  owner_name: string | null;
  category: BillCategory;
  billing_month: string;
  /** Нэг тоолууртай ангиллууд (цахилгаан) — ус дулаанд NULL */
  prev_reading: number | null;
  current_reading: number | null;
  hot_prev: number | null;
  hot_current: number | null;
  cold_prev: number | null;
  cold_current: number | null;
  usage_amount: number | null;
  bill_amount: number;
  note: string | null;
}

const show = (value: number | null) => (value === null ? '—' : String(value));

/** Хоёр тооны зөрүү, 2 орон хүртэл дугуйруулсан */
function diffOf(prev: number, current: number): string {
  const value = current - prev;
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '—';
}

/** Хоёр заалтын зөрүү. Аль нэг нь байхгүй бол зураас. */
function diff(prev: number | null, current: number | null): string {
  if (prev === null || current === null) return '—';
  return diffOf(prev, current);
}

const CELL = 'px-2 py-2 text-right tabular-nums';
const INPUT =
  'w-16 rounded border border-slate-300 px-1.5 py-1 text-right text-sm tabular-nums outline-none focus:border-slate-900';

function WaterRow({ invoice, showOwner }: { invoice: InvoiceRow; showOwner: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    hotPrev: String(invoice.hot_prev ?? 0),
    hotCurrent: String(invoice.hot_current ?? 0),
    coldPrev: String(invoice.cold_prev ?? 0),
    coldCurrent: String(invoice.cold_current ?? 0),
  });

  async function save() {
    setBusy(true);
    setError(null);
    const response = await fetch('/api/admin/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: invoice.id, ...form }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? 'Хадгалахад алдаа гарлаа');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <tr className="hover:bg-slate-50">
        <td className="px-3 py-2 font-semibold tabular-nums">{invoice.flat_number}</td>
        {showOwner && (
          <td className="max-w-36 truncate px-2 py-2 text-xs text-slate-500">
            {invoice.owner_name ?? ''}
          </td>
        )}
        <td className={`${CELL} text-slate-500`}>{show(invoice.hot_prev)}</td>
        <td className={`${CELL} font-medium`}>{show(invoice.hot_current)}</td>
        <td className={`${CELL} text-rose-800`}>
          {diff(invoice.hot_prev, invoice.hot_current)}
        </td>
        <td className={`${CELL} text-slate-500`}>{show(invoice.cold_prev)}</td>
        <td className={`${CELL} font-medium`}>{show(invoice.cold_current)}</td>
        <td className={`${CELL} text-sky-800`}>
          {diff(invoice.cold_prev, invoice.cold_current)}
        </td>
        <td className={`${CELL} font-semibold`}>{show(invoice.usage_amount)}</td>
        <td className={`${CELL} font-semibold`}>{formatMnt(invoice.bill_amount)}</td>
        <td className="px-2 py-2 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Засах
            </button>
          <DeleteInvoiceButton
            id={invoice.id}
            flatNumber={invoice.flat_number}
            category={invoice.category}
            billingMonth={invoice.billing_month}
            billAmount={invoice.bill_amount}
          />
          </div>
        </td>
      </tr>
    );
  }

  const hotDiff = Number(form.hotCurrent) - Number(form.hotPrev);
  const coldDiff = Number(form.coldCurrent) - Number(form.coldPrev);
  const total = hotDiff + coldDiff;

  return (
    <tr className="bg-amber-50">
      <td className="px-3 py-2 font-semibold tabular-nums">{invoice.flat_number}</td>
      {showOwner && (
        <td className="max-w-36 truncate px-2 py-2 text-xs text-slate-500">
          {invoice.owner_name ?? ''}
        </td>
      )}

      <td className="px-2 py-2 text-right">
        <input
          inputMode="decimal"
          value={form.hotPrev}
          onChange={(e) => setForm({ ...form, hotPrev: e.target.value })}
          className={INPUT}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <input
          inputMode="decimal"
          value={form.hotCurrent}
          onChange={(e) => setForm({ ...form, hotCurrent: e.target.value })}
          className={INPUT}
        />
      </td>
      <td className={`${CELL} bg-rose-50 font-semibold text-rose-900`}>
        {Number.isFinite(hotDiff) ? hotDiff : '—'}
      </td>

      <td className="px-2 py-2 text-right">
        <input
          inputMode="decimal"
          value={form.coldPrev}
          onChange={(e) => setForm({ ...form, coldPrev: e.target.value })}
          className={INPUT}
        />
      </td>
      <td className="px-2 py-2 text-right">
        <input
          inputMode="decimal"
          value={form.coldCurrent}
          onChange={(e) => setForm({ ...form, coldCurrent: e.target.value })}
          className={INPUT}
        />
      </td>
      <td className={`${CELL} bg-sky-50 font-semibold text-sky-900`}>
        {Number.isFinite(coldDiff) ? coldDiff : '—'}
      </td>

      <td className={`${CELL} font-bold`}>{Number.isFinite(total) ? total : '—'}</td>
      <td className={`${CELL} text-xs text-slate-500`}>систем бодно</td>

      <td className="px-2 py-2">
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? '…' : 'Хадгалах'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white"
          >
            Болих
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-right text-[11px] text-red-600">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

/**
 * Нэг тоолууртай ангиллын мөр.
 *
 * Цахилгаанд ЗААЛТЫГ засна (төлбөрийг систем бодно), СӨХ-д ДҮНГ засна
 * (тэнд тоолуур байхгүй, Excel-ээс бэлэн дүн ирдэг).
 */
function PlainRow({
  invoice,
  isMetered,
  showOwner,
}: {
  invoice: InvoiceRow;
  isMetered: boolean;
  showOwner: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billAmount, setBillAmount] = useState(String(invoice.bill_amount));
  const [form, setForm] = useState({
    prevReading: String(invoice.prev_reading ?? 0),
    currentReading: String(invoice.current_reading ?? 0),
  });

  async function save() {
    setBusy(true);
    setError(null);
    const response = await fetch('/api/admin/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isMetered ? { id: invoice.id, ...form } : { id: invoice.id, billAmount }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? 'Хадгалахад алдаа гарлаа');
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <tr className={editing ? 'bg-amber-50' : 'hover:bg-slate-50'}>
      <td className="px-3 py-2 font-semibold tabular-nums">{invoice.flat_number}</td>
      {showOwner && (
        <td className="max-w-40 truncate px-2 py-2 text-xs text-slate-500">
          {invoice.owner_name ?? ''}
        </td>
      )}
      {/* Тоолууртай ангилал (цахилгаан) — заалт, зөрүү, тооцоонд орсон кВт·ц.
          Зөрүү ба кВт·ц нь ӨӨР тоо: кВт·ц = зөрүү × алдагдлын коэфф. */}
      {isMetered && (
        <>
          {editing ? (
            <>
              <td className="px-2 py-2 text-right">
                <input
                  inputMode="decimal"
                  value={form.prevReading}
                  onChange={(e) => setForm({ ...form, prevReading: e.target.value })}
                  className={INPUT}
                />
              </td>
              <td className="px-2 py-2 text-right">
                <input
                  inputMode="decimal"
                  value={form.currentReading}
                  onChange={(e) => setForm({ ...form, currentReading: e.target.value })}
                  className={INPUT}
                />
              </td>
            </>
          ) : (
            <>
              <td className={`${CELL} text-slate-500`}>{show(invoice.prev_reading)}</td>
              <td className={`${CELL} font-medium`}>{show(invoice.current_reading)}</td>
            </>
          )}

          <td className={`${CELL} font-semibold text-amber-800`}>
            {editing
              ? diffOf(Number(form.prevReading), Number(form.currentReading))
              : diff(invoice.prev_reading, invoice.current_reading)}
          </td>

          <td className={`${CELL} font-semibold`}>
            {editing ? (
              <span className="text-xs font-normal text-slate-500">систем бодно</span>
            ) : (
              show(invoice.usage_amount)
            )}
          </td>
        </>
      )}

      <td className={CELL}>
        {editing && !isMetered ? (
          <input
            inputMode="decimal"
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value)}
            className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-slate-900"
          />
        ) : editing ? (
          <span className="text-xs text-slate-500">систем бодно</span>
        ) : (
          <span className="font-semibold">{formatMnt(invoice.bill_amount)}</span>
        )}
      </td>
      <td className="px-2 py-2">
        <div className="flex justify-end gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? '…' : 'Хадгалах'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white"
              >
                Болих
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Засах
              </button>
          <DeleteInvoiceButton
                id={invoice.id}
                flatNumber={invoice.flat_number}
                category={invoice.category}
                billingMonth={invoice.billing_month}
                billAmount={invoice.bill_amount}
              />
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-1 text-right text-[11px] text-red-600">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

export function InvoiceList({
  invoices,
  category,
  month,
}: {
  invoices: InvoiceRow[];
  category: BillCategory;
  /** 'YYYY-MM' — баганын толгойд «8 сар / 9 сар» гэж бичихэд хэрэглэнэ */
  month: string;
}) {
  const isWater = category === 'WATER_HEAT';
  // Цахилгаанд тоолуур бий → заалт засна. СӨХ-д тоолуургүй → дүн засна.
  const isMetered = category === 'ELECTRICITY';
  /**
   * 210 тоотын 4 нь л нэртэй (арилжааны хэсгүүд). Хоосон багана дэлгэцийн
   * өргөнийг дэмий идэж, нүдийг тарааж байсан тул нэр огт байхгүй үед
   * баганыг БҮРЭН хасна.
   */
  const showOwner = invoices.some((i) => i.owner_name);

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
        Энэ сар, ангилалд нэхэмжлэл олдсонгүй.
      </div>
    );
  }

  const total = invoices.reduce((sum, i) => sum + Number(i.bill_amount), 0);
  const prevLabel = shortMonth(previousMonth(month));
  const currentLabel = shortMonth(month);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[36rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
            {isWater ? (
              <>
                {/* Excel шиг бүлгийн мөр — аль тоолуур болох нь нэг харцаар мэдэгдэнэ */}
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th colSpan={3} className="border-x border-slate-200 bg-rose-50/70 px-2 py-1.5 text-center font-bold text-rose-900">
                    Халуун ус
                  </th>
                  <th colSpan={3} className="border-r border-slate-200 bg-sky-50/70 px-2 py-1.5 text-center font-bold text-sky-900">
                    Хүйтэн ус
                  </th>
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                </tr>
                <tr className="border-b border-slate-200 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-medium">Тоот</th>
                  {showOwner && <th className="px-2 py-2 text-left font-medium">Эзэн</th>}
                  <th className="px-2 py-2 text-right font-medium">{prevLabel}</th>
                  <th className="px-2 py-2 text-right font-medium">{currentLabel}</th>
                  <th className="px-2 py-2 text-right font-medium">зөрүү</th>
                  <th className="px-2 py-2 text-right font-medium">{prevLabel}</th>
                  <th className="px-2 py-2 text-right font-medium">{currentLabel}</th>
                  <th className="px-2 py-2 text-right font-medium">зөрүү</th>
                  <th className="px-2 py-2 text-right font-medium">нийт м³</th>
                  <th className="px-2 py-2 text-right font-medium">төлбөр</th>
                  <th className="px-2 py-2" />
                </tr>
              </>
            ) : (
              <>
                {/* Заалтын багануудыг бүлэглэнэ — «8 сар · 9 сар · зөрүү»
                    гурав нэг зүйлийн тухай, «кВт·ц · төлбөр» нь өөр. */}
                {isMetered && (
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-1.5" />
                    {showOwner && <th className="px-2 py-1.5" />}
                    <th
                      colSpan={3}
                      className="border-x border-slate-200 bg-slate-100/70 px-2 py-1.5 text-center font-bold text-slate-600"
                    >
                      Заалт
                    </th>
                    <th className="px-2 py-1.5" />
                    <th className="px-2 py-1.5" />
                    <th className="px-2 py-1.5" />
                  </tr>
                )}
                <tr className="border-b border-slate-200 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left font-medium">Тоот</th>
                  {showOwner && <th className="px-2 py-2 text-left font-medium">Эзэн</th>}
                  {isMetered && (
                    <>
                      <th className="px-2 py-2 text-right font-medium">{prevLabel}</th>
                      <th className="px-2 py-2 text-right font-medium">{currentLabel}</th>
                      <th className="px-2 py-2 text-right font-medium">зөрүү</th>
                      <th className="px-2 py-2 text-right font-medium">кВт·ц</th>
                    </>
                  )}
                  <th className="px-2 py-2 text-right font-medium">төлбөр</th>
                  <th className="px-2 py-2" />
                </tr>
              </>
            )}
          </thead>

          <tbody className="divide-y divide-slate-100 [&>tr:nth-child(even)]:bg-slate-50/50">
            {invoices.map((invoice) =>
              isWater ? (
                <WaterRow key={invoice.id} invoice={invoice} showOwner={showOwner} />
              ) : (
                <PlainRow key={invoice.id} invoice={invoice} isMetered={isMetered} showOwner={showOwner} />
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-baseline justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">{invoices.length} нэхэмжлэл</span>
        <span className="text-lg font-bold tabular-nums text-slate-900">{formatMnt(total)}</span>
      </div>
    </div>
  );
}
