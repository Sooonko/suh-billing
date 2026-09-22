import Link from 'next/link';

/**
 * Сегмент товч — 2–4 сонголтын хооронд шилжих.
 *
 * `<select>`-ийн оронд ЯАГААД: сонголтууд бүгд нүдэн дээр харагдана,
 * админ юу сонгосныг нэг харцаар мэднэ, бас нэг дарахад шилждэг.
 *
 * Холбоос (Link) хэлбэрээр хийсэн — товч дарахад ШУУД шүүнэ. Дарчихаад
 * дараа нь «Шүүх» дарах шаардлагатай бол товч дарсан хэрнээ юу ч
 * болоогүй шиг санагдана.
 */
export function SegmentedNav({
  items,
}: {
  items: { key: string; label: string; href: string; active: boolean }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/70 p-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
            item.active
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
