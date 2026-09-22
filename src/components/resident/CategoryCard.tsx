import { formatBillingMonth, formatMnt, formatReading, previousMonth, shortMonth } from '@/lib/format';
import type { FlatCategoryState } from '@/lib/types';
import { BillBreakdown } from './BillBreakdown';
import { OverpaymentNote } from './OverpaymentNote';
import { StatusBadge } from './StatusBadge';

/**
 * Картын гадна бүрхүүл.
 *
 * Веб дээр 3 багана зэрэгцэхэд мөрүүд нь ТЭГШ байх ёстой: 1-р мөрөнд карт,
 * 2-р мөрөнд «Төлбөр хэрхэн бодогдсон бэ?» товч. Үүнийг subgrid-ээр
 * шийдсэн — эцэг grid-ийн мөрийг өвлөж авдаг тул карт өөр өөр өндөртэй
 * байсан ч доод мөр, товч хоёр эгнэнэ.
 */
const SHELL =
  'flex flex-col gap-4 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:gap-4';

interface Props {
  state: FlatCategoryState;
  /** СӨХ-д тоолуур байхгүй тул заалтын хэсгийг нуухад ашиглана */
  hasMeter: boolean;
  /**
   * Ангиллын нэр. Веб дээр 3 карт зэрэгцэж, таб байхгүй тул карт өөрөө
   * аль ангилал болохыг хэлэх шаардлагатай. Гар утсан дээр таб хэлчихдэг
   * учир дамжуулахгүй.
   */
  label?: string;
}

/** Нэг мөр өгөгдөл: шошго зүүн, утга баруун */
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className={strong ? 'text-base font-semibold text-slate-900' : 'text-sm text-slate-900'}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Нэг ангиллын нэхэмжлэлийн карт.
 *
 * "Нийт төлөх дүн" = balance. Энэ нь өмнөх бүх сарын өр + энэ сарын нэхэмжлэл −
 * төлсөн бүх мөнгө. Тиймээс илүү төлөлт аяндаа хасагдсан байдаг.
 */
export function CategoryCard({ state, hasMeter, label }: Props) {
  const {
    balance, bill_amount, billing_month, prev_reading, current_reading, usage_amount, status,
    hot_prev, hot_current, cold_prev, cold_current, breakdown, total_billed, total_paid,
  } = state;

  // Ус дулаанд ХОЁР тоолуур. Заалт байгаа эсэхээр нь таньна — ангилал шалгахгүй,
  // ингэснээр хожим өөр ангилал хоёр тоолууртай болоход ч ажиллана.
  const hasTwoMeters = hot_current !== null || cold_current !== null;

  /**
   * Өмнөх саруудын нэхэмжлэл = бүх нэхэмжлэл − энэ сарынх.
   *
   * ⚠️ Урьд нь `balance − bill_amount` гэж бодоод «өмнөх үлдэгдэл» гэж
   * нэрлэдэг байв. Тэр нь БУРУУ: балансад төлсөн мөнгө ч багтдаг тул энэ
   * сар төлсөн төлбөр «өмнөх илүү төлөлт» болж харагддаг байсан.
   */
  const previousBilled = Math.round((total_billed - (bill_amount ?? 0)) * 100) / 100;

  // Заалтын баганын толгойд бичих сарууд — «8 сар», «9 сар»
  const currentLabel = shortMonth(billing_month);
  const prevLabel = billing_month ? shortMonth(previousMonth(billing_month)) : '—';

  // Нэхэмжлэл ороогүй ч төлсөн мөнгө байж болно (жишээ: урьдчилж төлсөн) —
  // тиймээс үлдэгдлийг нуухгүй, байгаа л бол харуулна.
  if (!billing_month) {
    /*
     * Нэхэмжлэлгүй үеийн карт нь БУСАДТАЙ ИЖИЛ бүтэцтэй байх ёстой —
     * толгой, бие, доод мөр гурав. Эс бөгөөс веб дээр 3 багана зэрэгцэхэд
     * энэ багана өөр өндөр, өөр байрлалтай болж эвдэрнэ.
     */
    return (
      <div className={SHELL}>
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              {label && <p className="truncate font-semibold text-slate-900">{label}</p>}
              <span className="text-sm font-medium text-slate-400">—</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <p aria-hidden className="text-2xl">🧾</p>
            <p className="mt-2 text-sm font-medium text-slate-600">Нэхэмжлэл хараахан ороогүй</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              СӨХ сарын нэхэмжлэлээ оруулсны дараа
              <br />
              заалт, дүн энд харагдана.
            </p>
          </div>

          {/* Доод мөр — бусад карттай нэг түвшинд эгнэнэ */}
          <div
            className={`flex items-baseline justify-between gap-4 px-5 py-4 ${
              balance > 0 ? 'bg-red-50' : balance < 0 ? 'bg-blue-50' : 'bg-slate-50'
            }`}
          >
            <span className="text-sm font-semibold text-slate-700">
              {balance < 0 ? 'Илүү төлсөн дүн' : 'Нийт төлөх дүн'}
            </span>
            <span
              className={`text-2xl font-bold tabular-nums ${
                balance > 0 ? 'text-red-700' : balance < 0 ? 'text-blue-700' : 'text-slate-400'
              }`}
            >
              {formatMnt(balance)}
            </span>
          </div>
        </div>

        {/* Задаргаа байхгүй ч 2-р мөрийн БАЙРЫГ эзэлнэ — эс бөгөөс энэ
            багана дангаараа сунаж, доод мөр нь бусдын товчтой нэг шугамд
            буудаг. */}
        <div className="hidden lg:block" />

        <OverpaymentNote balance={balance} />
      </div>
    );
  }

  return (
    /*
     * h-full + flex: веб дээр 3 багана зэрэгцэхэд картууд ИЖИЛ ӨНДӨРТЭЙ
     * болж, «Нийт төлөх дүн» мөр гурвуулаа нэг түвшинд тэгширнэ. Доорх
     * задаргааны товч ч мөн адил эгнэнэ.
     */
    <div className={SHELL}>
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {label && <p className="truncate font-semibold text-slate-900">{label}</p>}
            <span className="text-sm font-medium text-slate-500">{formatBillingMonth(billing_month)}</span>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* ── Заалт: сар бүр ТУСДАА багана ────────────────────────────────
            «73 → 79» гэсэн бичиглэл аль нь аль сарынх болох нь ойлгомжгүй
            байсан тул толгойд сарын нэрийг бичив. */}
        {(hasTwoMeters || hasMeter) && (
          <table className="w-full border-b border-slate-100 text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2 text-left font-medium">Заалт</th>
                <th className="px-3 py-2 text-right font-medium">{prevLabel}</th>
                <th className="px-5 py-2 text-right font-medium">{currentLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hasTwoMeters ? (
                <>
                  <tr>
                    <td className="px-5 py-2 text-slate-600">Халуун ус</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {formatReading(hot_prev)}
                    </td>
                    <td className="px-5 py-2 text-right font-medium tabular-nums text-slate-900">
                      {formatReading(hot_current)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2 text-slate-600">Хүйтэн ус</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {formatReading(cold_prev)}
                    </td>
                    <td className="px-5 py-2 text-right font-medium tabular-nums text-slate-900">
                      {formatReading(cold_current)}
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td className="px-5 py-2 text-slate-600">Тоолуур</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {formatReading(prev_reading)}
                  </td>
                  <td className="px-5 py-2 text-right font-medium tabular-nums text-slate-900">
                    {formatReading(current_reading)}
                  </td>
                </tr>
              )}
              <tr className="bg-slate-50">
                <td className="px-5 py-2 font-medium text-slate-700" colSpan={2}>
                  {hasTwoMeters ? 'Нийт зарцуулалт' : 'Зарцуулалт'}
                </td>
                <td className="px-5 py-2 text-right font-bold tabular-nums text-slate-900">
                  {formatReading(usage_amount)}
                  {hasTwoMeters && ' м³'}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        <dl className="flex-1 divide-y divide-slate-100 px-5 py-2">
          {/* Энэ сарын нэхэмжлэл — хамгийн чухал мөр тул онцолно */}
          <div className="-mx-5 flex items-baseline justify-between gap-4 bg-amber-50 px-5 py-2.5">
            <dt className="text-sm font-semibold text-amber-900">Энэ сарын нэхэмжлэл</dt>
            <dd className="text-base font-bold tabular-nums text-amber-900">
              {formatMnt(bill_amount)}
            </dd>
          </div>
          {previousBilled !== 0 && (
            <Row label="Өмнөх саруудын нэхэмжлэл" value={formatMnt(previousBilled)} />
          )}
          <Row label="Төлсөн" value={total_paid === 0 ? '—' : `−${formatMnt(total_paid)}`} />
        </dl>

        {/* Нийт төлөх дүн — хамгийн чухал тоо тул онцлон харуулна */}
        <div
          className={`flex items-baseline justify-between gap-4 px-5 py-4 ${
            balance > 0 ? 'bg-red-50' : balance < 0 ? 'bg-blue-50' : 'bg-emerald-50'
          }`}
        >
          <span className="text-sm font-semibold text-slate-700">
            {balance < 0 ? 'Илүү төлсөн дүн' : 'Нийт төлөх дүн'}
          </span>
          <span
            className={`text-2xl font-bold tabular-nums ${
              balance > 0 ? 'text-red-700' : balance < 0 ? 'text-blue-700' : 'text-emerald-700'
            }`}
          >
            {formatMnt(balance)}
          </span>
        </div>
      </div>

      {breakdown && breakdown.length > 0 ? (
        <BillBreakdown lines={breakdown} />
      ) : (
        <div className="hidden lg:block" />
      )}

      <OverpaymentNote balance={balance} />
    </div>
  );
}
