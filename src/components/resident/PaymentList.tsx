'use client';

import { useMemo, useState } from 'react';
import { Dropdown } from './Dropdown';
import { formatBillingMonth, formatMnt } from '@/lib/format';
import { CATEGORIES, CATEGORY_LABEL, type BillCategory, type PaymentEntry } from '@/lib/types';

/**
 * Төлсөн баримтууд — «би хэзээ хэдийг төлсөн бэ».
 *
 * Зөвхөн ТӨЛБӨР харуулна. Нэхэмжлэлийг энд холихгүй — тэр нь дээрх
 * картуудад аль хэдийн байгаа бөгөөд хольсноор хүснэгт ойлгомжгүй болдог.
 */

const TONE: Record<BillCategory, string> = {
  WATER_HEAT: 'bg-sky-100 text-sky-900',
  SOH: 'bg-slate-100 text-slate-700',
  ELECTRICITY: 'bg-amber-100 text-amber-900',
};

/** Төлсний дараах үлдэгдэл — 0 бол ногоон «төлөгдсөн», үгүй бол улаан */
function Left({ value }: { value: number | null }) {
  if (value === null) return <>—</>;
  return value < 1 ? (
    <span className="font-medium text-emerald-700">0₮ ✓</span>
  ) : (
    <span className="font-medium text-red-700">{formatMnt(value)}</span>
  );
}

/** '2026-10' → '10 сар' (одоогийн жилийнх биш бол «2025 оны 12 сар») */
function shortMonth(month: string): string {
  const [year, m] = month.split('-');
  return year === String(new Date().getFullYear()) ? `${Number(m)} сар` : formatBillingMonth(month);
}

/** "2026-09-20T…" → "9 сарын 20" */
function showDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1} сарын ${d.getDate()}`;
}

/**
 * Төлбөр ЯГ АЛЬ САРУУДЫГ хассан бэ — сар бүрээр, тухайн сард хэдэн төгрөг
 * оногдсоныг хамт. Аль ч сард оногдоогүй хэсэг нь «Илүү төлөлт» мөр.
 *
 * ⚠️ Өмнө нь хамгийн их хэсгийг авсан сарыг л харуулаад «10 сар +1 сар»
 * гэж бичдэг байсан нь «+1 сар гэж аль сар вэ?» гэсэн асуулт үүсгэж байв.
 */
function linesOf(payment: PaymentEntry) {
  const parts = [...payment.covers].sort((x, y) => x.month.localeCompare(y.month));
  const covered = parts.reduce((sum, c) => sum + c.amount, 0);
  let extra = Math.round((payment.amount - covered) * 100) / 100;

  /*
   * ХАРАГДАЦЫН хялбаршуулалт (тооцоо өөрчлөгдөхгүй).
   *
   * FIFO-гоор: 8 сарын илүү 2,098₮ нь 9 сарын нэхэмжлэлээс хасагдаж, 9 сарын
   * 22-ны 51,173₮-ийн төлбөр «9 сар 49,075 + илүү 2,098» болж хуваагддаг.
   * Айлын харахад энэ нь «9 сараа бүтэн төлсөн» л байх ёстой. Тиймээс тухайн
   * төлбөрийн илүү хэсгийг өмнөх илүү төлөлт хасагдсан сар руу нь буцааж
   * нийлүүлнэ: «9 сар 51,173₮ · үлдсэн 0₮».
   */
  const lines = parts.map((c) => {
    const shift = Math.min(extra, c.credit);
    extra = Math.round((extra - shift) * 100) / 100;
    return {
      key: c.month,
      label: shortMonth(c.month),
      paid: c.amount + shift,
      billed: c.billed as number | null,
      before: (c.before + shift) as number | null,
      credit: c.credit - shift,
      after: c.after as number | null,
      extra: false,
    };
  });

  return [
    ...lines,
    ...(extra >= 1 || parts.length === 0
      ? [{ key: 'extra', label: 'Илүү төлөлт', paid: extra, billed: null, before: null, credit: 0, after: null, extra: true }]
      : []),
  ];
}

export function PaymentList({ payments }: { payments: PaymentEntry[] }) {
  const months = useMemo(
    () => [...new Set(payments.map((p) => p.month))].sort((a, b) => b.localeCompare(a)),
    [payments],
  );

  // Хамгийн сүүлийн сар анхдагчаар
  const [month, setMonth] = useState(months[0] ?? '');
  const [category, setCategory] = useState<BillCategory | ''>('');

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center">
        <p className="text-sm font-medium text-slate-600">Төлбөр хараахан бүртгэгдээгүй</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Банкаар төлсөн төлбөр 1–2 хоногийн дотор энд тусна.
        </p>
      </div>
    );
  }

  const rows = payments.filter(
    (p) => (month === '' || p.month === month) && (category === '' || p.category === category),
  );
  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Dropdown
          label="Сар"
          value={month}
          onChange={setMonth}
          options={[{ value: '', label: 'Бүх сар' }, ...months.map((m) => ({ value: m, label: formatBillingMonth(m) }))]}
        />
        <Dropdown<BillCategory | ''>
          label="Ангилал"
          value={category}
          onChange={setCategory}
          options={[{ value: '', label: 'Бүх ангилал' }, ...CATEGORIES.map((c) => ({ value: c.key, label: c.label }))]}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            Энэ шүүлтэд тохирох төлбөр байхгүй.
          </p>
        ) : (
          <>
            {/*
              УТСАН ДЭЭР 4 баганатай тусдаа хүснэгт (Огноо · Сар · Төлсөн ·
              Үлдсэн). Компьютерийн 8 баганыг шахахад «Төлсөн» баруун тийш
              түлхэгдэж харагдахгүй болдог байв. Ангилал нь огнооны доор.
            */}
            <table className="w-full text-[13px] sm:hidden">
              <thead className="bg-slate-50 text-[11px] text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pl-3 pr-1 text-left font-medium">Огноо</th>
                  <th className="px-2 py-2 text-left font-medium">Ямар сарын</th>
                  <th className="px-2 py-2 text-right font-medium">Хассан</th>
                  <th className="py-2 pl-1 pr-3 text-right font-medium">Үлдсэн</th>
                </tr>
              </thead>
              {/* Төлбөр бүр өөрийн <tbody> — олон сарыг хаасан мөрүүд нэг бүлэг */}
              {rows.map((payment) => {
                const lines = linesOf(payment);
                return (
                  <tbody key={payment.id} className="border-b border-slate-100 last:border-b-0">
                    {lines.map((l, i) => (
                      <tr key={l.key} className="align-top">
                        {i === 0 && (
                          <td rowSpan={lines.length} className="whitespace-nowrap py-2 pl-3 pr-1 text-slate-600">
                            {showDate(payment.date)}
                            {/* Тэр өдөр банкаар НИЙТ хэдийг төлсөн — сараар хуваагдахаас өмнөх дүн */}
                            <span className="mt-0.5 block text-[11px] text-slate-500">
                              Төлсөн{' '}
                              <span className="font-semibold tabular-nums text-emerald-700">
                                {formatMnt(payment.amount)}
                              </span>
                            </span>
                            {/* «Бүх ангилал» үед л — нэг ангилал сонгосон бол давхардал */}
                            {category === '' && (
                              <span
                                className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[payment.category]}`}
                              >
                                {CATEGORY_LABEL[payment.category]}
                              </span>
                            )}
                          </td>
                        )}
                        <td className={`px-2 py-2 ${l.extra ? 'text-blue-700' : 'whitespace-nowrap text-slate-700'}`}>
                          {l.extra ? 'Илүү' : l.label}
                        </td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-800">
                          <span className="whitespace-nowrap">{formatMnt(l.paid)}</span>
                          {l.credit >= 1 && (
                            <span className="block whitespace-normal text-[10px] font-normal leading-tight text-blue-700">
                              +{formatMnt(l.credit)} өмнө илүү төлсөн
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2 pl-1 pr-3 text-right tabular-nums">
                          {l.extra ? <span className="text-slate-400">—</span> : <Left value={l.after} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>

            <table className="hidden w-full text-sm sm:table">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 text-left font-medium">Огноо</th>
                  <th className="px-3 py-2 text-left font-medium">Ангилал</th>
                  {/*
                    Сар бүрээр: нэхэмжлэл → төлөхөд байсан үлдэгдэл → энэ
                    төлбөрөөс хассан → дараа нь үлдсэн. Оршин суугч «9 сард
                    30,000 төлөөд 5,000 үлдсэн, 10 сард тэрийгээ хаасан»
                    гэдгийг шууд уншина.
                  */}
                  <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Ямар сарын төлбөрт</th>
                  <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Нэхэмжлэл</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Төлөхөд үлдэгдэл</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Хассан</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Үлдсэн</th>
                  <th className="px-4 py-2 text-right font-medium">Төлсөн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((payment) => {
                  const lines = linesOf(payment);
                  return (
                  <tr key={payment.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {showDate(payment.date)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[payment.category]}`}
                      >
                        {CATEGORY_LABEL[payment.category]}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-left text-xs text-slate-700 sm:table-cell">
                      {lines.map((l) => (
                        <span key={l.key} className={`block whitespace-nowrap leading-5 ${l.extra ? 'text-blue-700' : ''}`}>
                          {l.label}
                        </span>
                      ))}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-xs tabular-nums text-slate-500 md:table-cell">
                      {lines.map((l) => (
                        <span key={l.key} className="block leading-5">
                          {l.billed === null ? '—' : formatMnt(l.billed)}
                        </span>
                      ))}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-xs tabular-nums text-slate-500 sm:table-cell">
                      {lines.map((l) => (
                        <span key={l.key} className="block leading-5">
                          {l.before === null ? '—' : formatMnt(l.before)}
                          {l.credit >= 1 && (
                            <span className="block text-[11px] leading-4 text-blue-700">
                              илүү төлөлт −{formatMnt(l.credit)}
                            </span>
                          )}
                        </span>
                      ))}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-xs tabular-nums text-slate-500 sm:table-cell">
                      {lines.map((l) => (
                        <span key={l.key} className="block leading-5">
                          <span className="text-slate-700">{formatMnt(l.paid)}</span>
                        </span>
                      ))}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-xs tabular-nums text-slate-500 sm:table-cell">
                      {lines.map((l) => (
                        <span key={l.key} className="block leading-5">
                          {l.extra ? '—' : <Left value={l.after} />}
                        </span>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                      {formatMnt(payment.amount)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex items-baseline justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-600">{rows.length} төлбөр</span>
              <span className="font-bold tabular-nums text-emerald-700">{formatMnt(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
