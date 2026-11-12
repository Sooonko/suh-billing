import { formatMnt } from '@/lib/format';
import type { BillLineDetail } from '@/lib/types';

/**
 * Нэхэмжлэлийн задаргаа — «яагаад ийм дүн гарав?»
 *
 * Тарифыг нэхэмжлэл үүсэх үед нь ХАДГАЛСАН тул тариф хожим өөрчлөгдсөн ч
 * хуучин сарын тайлбар зөв хэвээр байна.
 */
/**
 * БҮХ мөрийг (суурь хураамж, НӨАТ орно) харуулж, доор нь нийт дүн тавина.
 *
 * ⚠️ Өмнө нь суурь хураамж, ус халаалт, НӨАТ-ыг нуудаг байсан тул оршин
 * суугчид харагдаж буй мөрүүдийг нэмээд «төлбөр буруу бодогдсон» гэж
 * гомдоллож байв. Одоо мөрүүдийн нийлбэр = «Энэ сарын нэхэмжлэл».
 */
/**
 * Цахилгаан, СӨХ-д ӨМНӨХ дүрэм хэвээр — суурь хураамж, НӨАТ нуугдана,
 * нийт дүнгийн мөргүй. Ус, дулаанд (`full`) бүх мөр + нийт дүн.
 */
const HIDDEN_CODES = new Set(['BASE_FEE', 'HEATING', 'HEAT_BASE_FEE', 'VAT']);

export function BillBreakdown({
  lines: allLines,
  total,
  full = false,
}: {
  lines: BillLineDetail[];
  total: number | null;
  full?: boolean;
}) {
  const lines = full ? allLines : allLines.filter((line) => !HIDDEN_CODES.has(line.code));
  if (!lines.length) return null;
  const vat = lines.filter((l) => l.unit === 'PERCENT');
  const items = lines.filter((l) => l.unit !== 'PERCENT');
  const subtotal = items.reduce((sum, l) => sum + l.amount, 0);

  return (
    <details className="w-full self-start rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium text-slate-700">
        Төлбөр хэрхэн бодогдсон бэ?
      </summary>

      <dl className="divide-y divide-slate-100 border-t border-slate-100 px-5 py-1">
        {[...items, ...vat].map((line) => (
          <div key={line.code} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="min-w-0">
              <span className="text-sm text-slate-700">{line.label}</span>
              <span className="block text-xs text-slate-400">
                {line.unit === 'PER_M3'
                  ? `${line.rate.toLocaleString('mn-MN')}₮ × ${line.qty} м³`
                  : line.unit === 'PER_M2'
                    ? `${line.rate.toLocaleString('mn-MN')}₮ × ${line.qty} м²`
                  : line.unit === 'PERCENT'
                    ? `${formatMnt(line.qty)}-ийн ${line.rate}%`
                    : ''}
              </span>
            </dt>
            <dd className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
              {formatMnt(line.amount)}
            </dd>
          </div>
        ))}
      </dl>

      {full && (
      <div className="flex items-baseline justify-between rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-3">
        <span className="text-sm font-semibold text-slate-900">Энэ сарын нэхэмжлэл</span>
        <span className="text-sm font-bold tabular-nums text-slate-900">
          {formatMnt(total ?? subtotal + vat.reduce((sum, l) => sum + l.amount, 0))}
        </span>
      </div>
      )}
    </details>
  );
}
