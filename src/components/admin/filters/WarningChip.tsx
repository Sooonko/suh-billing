/**
 * Анхааруулах чип — «2 мөрд заалт нэмэгдээгүй» гэх мэт.
 *
 * ЯАГААД: 200 мөрт хүснэгтэд эмзэг мөр хаана байгааг админ гүйлгэж
 * хайдаг байв. Тоог ДЭЭР нь хэлж өгвөл эргэлзэх шаардлага үгүй болно —
 * 0 бол чип огт гарахгүй, «бүх юм хэвийн» гэсэн санаа.
 */
export function WarningChip({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-3.5 w-3.5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v.01M12 11v5" strokeLinecap="round" />
      </svg>
      <span>
        <span className="font-bold tabular-nums">{count}</span> {label}
      </span>
    </span>
  );
}
