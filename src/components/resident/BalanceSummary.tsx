import { formatMnt, formatMonthList } from '@/lib/format';
import { settledBalance } from '@/lib/money';
import { CATEGORIES, type BillCategory, type DebtRow, type FlatCategoryState } from '@/lib/types';

/**
 * Төлбөрийн хураангуй — ангилал бүр ТОМ, нийт дүн баруун доод буланд ЖИЖИГ.
 *
 * ЯАГААД НИЙТ ДҮНГ ЖИЖИГРҮҮЛЭВ: өмнө нь «Нийт төлөх дүн 104,123₮» хамгийн
 * том тоо байсан тул оршин суугчид «манайх яагаад ийм их төлөх вэ» гэж
 * асуудаг байв. Ангилал бүр ӨӨР дансанд төлөгддөг тул хүн ангиллаар нь
 * ойлгож, «цахилгаан 3,917₮, СӨХ 35,000₮…» гэж уншаад нийтийг нь дараа
 * харах ёстой.
 *
 * Ангилал бүрийн доор «энэ сарын төлбөр / өмнөх өр» задаргаа — их дүнгийн
 * шалтгаан ихэвчлэн хуримтлагдсан өр байдаг. Хаалганы мэдэгдэлтэй ижил
 * бүтэц тул QR уншуулж орсон хүн цаасан дээрхтэйгээ ижил зүйл харна.
 *
 * Өртэй ангиллын дүн УЛААН — оршин суугчид өмнөх загвараас танил өнгө.
 */
export function BalanceSummary({
  byCategory,
  debts,
  onSelect,
}: {
  byCategory: Map<BillCategory, FlatCategoryState>;
  /** Төлөгдөөгүй сарууд (FIFO), хуучнаас нь */
  debts: DebtRow[];
  /** Гар утсан дээр дарахад тухайн ангиллын таб руу */
  onSelect: (category: BillCategory) => void;
}) {
  const balances = CATEGORIES.map(({ key }) => settledBalance(Number(byCategory.get(key)?.balance ?? 0)));
  /**
   * Нийт — ЗӨВХӨН өртэй ангиллууд. Илүү төлөлтийг ХАСАХГҮЙ: данс тусдаа
   * тул цахилгааны илүүгээр ус дулааны өрөө хаах боломжгүй. Өмнө нь
   * хасдаг байсан тул 107 тоот 40,150₮ төлөх ёстой байхад «1,576₮» гэж
   * худал харуулж байв.
   */
  const total = balances.reduce((sum, b) => (b > 0 ? sum + b : sum), 0);
  const overpaid = balances.reduce((sum, b) => (b < 0 ? sum - b : sum), 0);

  return (
    <section
      aria-label="Төлбөрийн хураангуй"
      className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:mb-7"
    >
      <div className="divide-y divide-slate-100 md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
        {CATEGORIES.map(({ key, label }, i) => (
          <CategoryTile
            key={key}
            label={label}
            balance={balances[i]}
            state={byCategory.get(key)}
            debts={debts.filter((d) => d.category === key)}
            onClick={() => onSelect(key)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-0.5 border-t border-slate-100 bg-slate-50/70 px-5 py-2.5 text-sm text-slate-500 md:px-6">
        {total === 0 && overpaid === 0 ? (
          <span className="text-emerald-700">Бүх төлбөр цэвэр байна 🎉</span>
        ) : (
          <>
            {/* Өртэй БА илүү төлсөн зэрэг байж болно — данс тусдаа учраас */}
            {overpaid > 0 && (
              <span>
                Илүү төлсөн: <span className="font-semibold tabular-nums text-blue-700">{formatMnt(overpaid)}</span>
              </span>
            )}
            {total > 0 && (
              <span>
                Нийт үлдэгдэл: <span className="font-semibold tabular-nums text-slate-700">{formatMnt(total)}</span>
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CategoryTile({
  label,
  balance,
  state,
  debts,
  onClick,
}: {
  label: string;
  balance: number;
  state: FlatCategoryState | undefined;
  debts: DebtRow[];
  onClick: () => void;
}) {
  /**
   * Задаргаа. «Энэ сар» = тухайн ангиллын хамгийн сүүлийн нэхэмжлэлийн сар.
   * Өмнөх өрийг ҮЛДЭГДЛЭЭС хасаж бодно (сарын мөрүүдийг нэмэхгүй) —
   * `debts` нь 50₮-өөс бага сарыг шүүсэн тул нэмбэл дээрх том тоотой
   * хэдэн төгрөгөөр зөрнө.
   */
  const month = state?.billing_month ?? null;
  const current = month ? (debts.find((d) => d.month === month)?.remaining ?? 0) : 0;
  const previous = settledBalance(balance - current);
  const previousMonths = debts.filter((d) => month && d.month < month).map((d) => d.month);
  const monthLabel = month ? `${Number(month.slice(5, 7))} сарын төлбөр` : 'Энэ сарын төлбөр';

  return (
    <button
      type="button"
      onClick={onClick}
      // Веб дээр 3 карт доор зэрэгцэж харагддаг тул дарах шаардлагагүй.
      // flex-col + justify-start: <button> агуулгаа анхдагчаар БОСООГООР
      // голлуулдаг тул задаргаа урт ангиллын хажууд бусад нь доошилж,
      // 3 дүн нэг шугамд буухгүй байв.
      className="flex w-full flex-col justify-start px-5 py-4 text-left transition hover:bg-slate-50 md:px-6 md:py-5 lg:pointer-events-none lg:cursor-default lg:hover:bg-transparent"
    >
      <div className="flex items-baseline justify-between gap-3 md:block">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p
          className={`flex items-baseline gap-1 text-2xl font-bold tabular-nums tracking-tight md:mt-1 md:text-3xl ${
            balance > 0 ? 'text-red-700' : balance < 0 ? 'text-blue-700' : 'text-emerald-700'
          }`}
        >
          {balance === 0 ? (
            <span className="text-lg md:text-xl">✓ Төлөгдсөн</span>
          ) : (
            formatMnt(balance)
          )}
          {/* Дарвал таб руу шилжинэ гэдгийг гар утсан дээр л хэлнэ */}
          <span aria-hidden className="ml-1 text-base font-normal text-slate-300 md:hidden">
            ›
          </span>
        </p>
      </div>

      {balance > 0 && (
        <div className="mt-1.5 space-y-0.5 text-xs md:mt-2 md:text-sm">
          {previous > 0 ? (
            <>
              {current > 0 && (
                <p className="flex justify-between gap-3 text-slate-500">
                  <span>{monthLabel}</span>
                  <span className="tabular-nums">{formatMnt(current)}</span>
                </p>
              )}
              <p className="flex justify-between gap-3 font-semibold text-red-700">
                <span>
                  Өмнөх өр{previousMonths.length > 0 && ` (${formatMonthList(previousMonths)})`}
                </span>
                <span className="tabular-nums">{formatMnt(previous)}</span>
              </p>
            </>
          ) : (
            <p className="text-slate-500">{monthLabel}</p>
          )}
        </div>
      )}
      {balance < 0 && <p className="mt-1.5 text-xs text-blue-700 md:text-sm">Илүү төлсөн — дараа сард зарцуулагдана</p>}
    </button>
  );
}
