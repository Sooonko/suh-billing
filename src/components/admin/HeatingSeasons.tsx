'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/ui/Feedback';
import { MonthInput } from '@/components/ui/MonthInput';
import { callApi } from '@/lib/api-client';
import { formatBillingMonth } from '@/lib/format';

/**
 * Халаалтын улирал — улирлын гадна сард «Халаалт (м²)» ба «Дулааны суурь
 * хураамж» бодогдохгүй.
 *
 * Тарифын ҮНЭ нь доорх хүснэгтэд, ХУГАЦАА нь энд — дараа жил үнийг дахин
 * оруулах шаардлагагүй, зөвхөн шинэ улирал нэмнэ.
 */

export interface HeatingSeason {
  id: string;
  start_month: string;
  end_month: string;
}

export function HeatingSeasons({
  seasons,
  currentMonth,
  seasonalLabels,
}: {
  seasons: HeatingSeason[];
  /** Улаанбаатарын цагаар — сервер дээр бодсон, гидрацийн зөрүүгүй */
  currentMonth: string;
  /** Улирлаас хамаарах тарифын нэрс — «Халаалт», «Дулааны суурь хураамж» */
  seasonalLabels: string[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!start || !end) return;
    setBusy(true);
    setError(null);
    const result = await callApi('/api/admin/heating-seasons', {
      method: 'POST',
      json: { startMonth: start, endMonth: end },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStart(null);
    setEnd(null);
    router.refresh();
  }

  async function remove(season: HeatingSeason) {
    const ok = await confirm({
      title: 'Улирал устгах уу?',
      details: [['Улирал', `${formatBillingMonth(season.start_month)} — ${formatBillingMonth(season.end_month)}`]],
      warning: 'Аль хэдийн үүссэн нэхэмжлэл өөрчлөгдөхгүй. Дараагийн импортоос халаалт бодогдохгүй болно.',
      confirmLabel: 'Устгах',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await callApi(`/api/admin/heating-seasons?id=${season.id}`, { method: 'DELETE' });
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  const status = (s: HeatingSeason) =>
    s.end_month < currentMonth
      ? { text: 'Дууссан', cls: 'bg-slate-100 text-slate-500' }
      : s.start_month > currentMonth
        ? { text: 'Удахгүй', cls: 'bg-blue-100 text-blue-800' }
        : { text: 'Одоо идэвхтэй', cls: 'bg-orange-100 text-orange-800' };

  const active = seasons.some((s) => s.start_month <= currentMonth && currentMonth <= s.end_month);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Халаалтын улирал</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${active ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-600'}`}>
          {formatBillingMonth(currentMonth)}: {active ? 'халаалт бодогдоно' : 'халаалт бодогдохгүй'}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Улирлын гадна сард{' '}
        {seasonalLabels.length ? seasonalLabels.map((l) => `«${l}»`).join(', ') : 'улирлын тарифууд'} бодогдохгүй.
        Эхлэх, дуусах сар хоёулаа улиралд орно. Аль хэдийн үүссэн нэхэмжлэл өөрчлөгдөхгүй.
      </p>

      {seasons.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {seasons.map((s) => {
            const st = status(s);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-900">
                  {formatBillingMonth(s.start_month)} — {formatBillingMonth(s.end_month)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.text}</span>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  className="ml-auto text-xs font-medium text-red-600 hover:text-red-800"
                >
                  Устгах
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Эхлэх сар</span>
          <MonthInput value={start} onChange={setStart} ariaLabel="Эхлэх сар" placeholder="Сонгох" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-600">Дуусах сар</span>
          <MonthInput value={end} onChange={setEnd} ariaLabel="Дуусах сар" placeholder="Сонгох" />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy || !start || !end}
          className="h-9 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Нэмж байна…' : 'Улирал нэмэх'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
