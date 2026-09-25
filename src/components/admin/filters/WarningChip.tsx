import Link from 'next/link';

/**
 * Анхааруулах чип — «26 мөрд заалт нэмэгдээгүй» гэх мэт.
 *
 * ЯАГААД: 200 мөрт хүснэгтэд эмзэг мөр хаана байгааг админ гүйлгэж
 * хайдаг байв. Тоог ДЭЭР нь хэлж өгвөл эргэлзэх шаардлага үгүй болно —
 * 0 бол чип огт гарахгүй, «бүх юм хэвийн» гэсэн санаа.
 *
 * `href` өгвөл ДАРЖ БОЛДОГ шүүлт болно. Тоог хэлчихээд «тэгээд тэднийг
 * яаж харах вэ» гэдгийг хариулахгүй бол чип хагас ажил хийж байгаа хэрэг.
 * `active` үед тод болж, дахин дарахад шүүлт цуцлагдана.
 */
export function WarningChip({
  count,
  label,
  href,
  active = false,
}: {
  count: number;
  label: string;
  href?: string;
  active?: boolean;
}) {
  if (count === 0) return null;

  const body = (
    <>
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
      {active && (
        <span aria-hidden className="ml-0.5 text-amber-700">
          ✕
        </span>
      )}
    </>
  );

  const tone = active
    ? 'border-amber-400 bg-amber-100 text-amber-950 shadow-sm'
    : 'border-amber-200 bg-amber-50 text-amber-900';
  const shell = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${tone}`;

  if (!href) return <span className={shell}>{body}</span>;

  return (
    <Link
      href={href}
      aria-pressed={active}
      title={active ? 'Шүүлтийг цуцлах' : `${count} мөрийг л харах`}
      className={`${shell} transition hover:border-amber-400 hover:bg-amber-100`}
    >
      {body}
    </Link>
  );
}
