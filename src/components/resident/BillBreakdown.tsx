import { formatMnt } from '@/lib/format';
import type { BillLineDetail } from '@/lib/types';

/**
 * Оршин суугчид ХАРУУЛАХГҮЙ мөрүүд.
 *
 * СӨХ-ийн шийдвэр: суурь хураамж, ус халаалт, НӨАТ-ыг задаргаанд гаргахгүй.
 *
 * ⚠️ Зөвхөн ХАРАГДАЦ. Эдгээр дүн «Нийт төлөх дүн»-д багтсан хэвээр —
 * задаргааны мөрүүдийн нийлбэр нийт дүнтэй тэнцэхгүй байж болно.
 */
const HIDDEN_CODES = new Set(['BASE_FEE', 'HEATING', 'VAT']);

/**
 * Нэхэмжлэлийн задаргаа — «яагаад ийм дүн гарав?»
 *
 * Тарифыг нэхэмжлэл үүсэх үед нь ХАДГАЛСАН тул тариф хожим өөрчлөгдсөн ч
 * хуучин сарын тайлбар зөв хэвээр байна.
 */
export function BillBreakdown({ lines: allLines }: { lines: BillLineDetail[] }) {
  const lines = allLines.filter((line) => !HIDDEN_CODES.has(line.code));
  if (!lines.length) return null;

  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium text-slate-700">
        Төлбөр хэрхэн бодогдсон бэ?
      </summary>

      <dl className="divide-y divide-slate-100 border-t border-slate-100 px-5 py-1">
        {lines.map((line) => (
          <div key={line.code} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="min-w-0">
              <span className="text-sm text-slate-700">{line.label}</span>
              <span className="block text-xs text-slate-400">
                {line.unit === 'PER_M3'
                  ? `${line.rate.toLocaleString('mn-MN')}₮ × ${line.qty} м³`
                  : line.unit === 'PERCENT'
                    ? `${formatMnt(line.qty)}-ийн ${line.rate}%`
                    : 'сарын тогтмол'}
              </span>
            </dt>
            <dd className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
              {formatMnt(line.amount)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
