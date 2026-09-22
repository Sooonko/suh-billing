import { formatBillingMonth, formatMnt } from '@/lib/format';
import { CATEGORY_LABEL, type BillCategory, type DebtRow } from '@/lib/types';

/**
 * Өр үүссэн саруудын задаргаа — «аль сараас хойш өртэй вэ».
 *
 * Толгой нь «Төлсөн түүх»-тэй ижил саарал. Улаан өнгийг ЗӨВХӨН дүнд
 * үлдээсэн — бүтэн хүснэгтийг улаан болговол нүд дасаж, жинхэнэ чухал
 * тоо нь ялгарахаа болино.
 *
 * Төлбөр тодорхой сарын нэхэмжлэлд наалддаггүй тул төлөгдсөн эсэхийг
 * FIFO дүрмээр тогтооно: төлсөн мөнгө хамгийн хуучин өрийг эхэлж хаана.
 *
 * Бүтэц нь «Төлсөн түүх» хүснэгттэй ижил — оршин суугч хоёрыг зэрэгцүүлж
 * уншихад нэг л хэв маягт дасна.
 */

const TONE: Record<BillCategory, string> = {
  WATER_HEAT: 'bg-sky-100 text-sky-900',
  SOH: 'bg-slate-100 text-slate-700',
  ELECTRICITY: 'bg-amber-100 text-amber-900',
};

export function DebtBreakdown({ debts }: { debts: DebtRow[] }) {
  if (debts.length === 0) return null;

  return (
    <section className="mb-5 md:mb-7">
      <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Өр үүссэн сарууд</h2>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2 text-left font-medium">Сар</th>
              <th className="px-3 py-2 text-left font-medium">Ангилал</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Нэхэмжилсэн</th>
              <th className="px-4 py-2 text-right font-medium">Үлдэгдэл</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {debts.map((debt) => (
              <tr key={`${debt.month}-${debt.category}`}>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {formatBillingMonth(debt.month).replace(/^\d{4} оны /, '')}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[debt.category]}`}
                  >
                    {CATEGORY_LABEL[debt.category]}
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell">
                  {formatMnt(debt.billed)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-red-700">
                  {formatMnt(debt.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Төлсөн мөнгө хамгийн хуучин өрийг эхэлж хаана.
      </p>
    </section>
  );
}
