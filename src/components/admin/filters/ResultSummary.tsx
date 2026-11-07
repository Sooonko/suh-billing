/**
 * Хүснэгтийн дээрх хэсэг: «юу харж байна», доор нь анхааруулгууд.
 *
 * ⚠️ Анхааруулга ЗҮҮН ТАЛД, тусдаа мөрөнд. Өмнө нь баруун буланд жижиг
 * чип байсан тул админ анзаардаггүй байв — нүд зүүнээс уншиж эхэлдэг.
 *
 * Шүүлт ба хүснэгтийн хооронд ЗААВАЛ байх ёстой мөр — админ аль шүүлт
 * хүчинтэй байгааг хүснэгт харахаас өмнө мэдэх хэрэгтэй.
 */
export function ResultSummary({
  scope,
  count,
  unit = 'мөр',
  children,
}: {
  /** «2026 оны 9 сарын ус, дулаан» гэх мэт */
  scope: string;
  count: number;
  unit?: string;
  /** Анхааруулах чипүүд */
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 space-y-2">
      <p className="text-sm text-slate-500">
        {scope} — <span className="font-bold text-slate-900">{count.toLocaleString('mn-MN')} {unit}</span>
      </p>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
