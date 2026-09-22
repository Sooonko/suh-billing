/**
 * Үндсэн цэсний нэг эх сурвалж.
 *
 * Гар утсан дээр доод цэс (BottomNav), веб дээр толгойн цэс (TopNav) болж
 * хоёр өөр хэлбэрээр зурагдана. Жагсаалт нэг л газар байснаар хоёр нь
 * хэзээ ч зөрөхгүй.
 */
export const NAV_ITEMS = [
  {
    href: '/',
    label: 'Мэдээ',
    // Хонх
    icon: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9',
  },
  {
    href: '/tolbor',
    label: 'Төлбөр',
    // Баримт
    icon: 'M9 12h6m-6 4h6m-6-8h6M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2Z',
  },
  {
    href: '/dans',
    label: 'Данс',
    // Карт
    icon: 'M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
  },
  {
    href: '/holboo',
    label: 'Холбоо',
    // Утас
    icon: 'M3 5a2 2 0 0 1 2-2h2.2a1 1 0 0 1 1 .8l.8 3.4a1 1 0 0 1-.3 1L7 9.8a12 12 0 0 0 5.2 5.2l1.6-1.7a1 1 0 0 1 1-.3l3.4.8a1 1 0 0 1 .8 1V17a2 2 0 0 1-2 2h-1A14 14 0 0 1 3 6V5Z',
  },
  {
    href: '/admin',
    label: 'Админ',
    // Цоож — оршин суугчид зориулаагүй гэдгийг дүрсээр хэлнэ
    icon: 'M7 11V8a5 5 0 0 1 10 0v3m-9 0h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z',
    /**
     * СӨХ-ийн ажилтны орох цэг. Нэвтрээгүй бол middleware нь /admin/login
     * руу шиднэ. Оршин суугчид зориулаагүй тул бусад цэснээс сааралдуу,
     * тусад нь тавина.
     */
    staff: true,
  },
] as const;

/**
 * Тухайн цэс сонгогдсон эсэх.
 * "/236" гэх тоотын дэлгэц ч "Төлбөр" таб дор байна гэж үзнэ.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/tolbor') return pathname === href || /^\/\d+$/.test(pathname);
  return pathname === href;
}

/** Цэсний дүрс — хоёр цэс хоёулаа хэрэглэнэ */
export function NavIcon({ d, active }: { d: string; active: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d={d} />
    </svg>
  );
}
