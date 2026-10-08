'use client';

import { useUnseen } from '@/components/home/news-hooks';
import type { NewsStamp } from '@/lib/news-seen';

/**
 * Цэсний «Мэдээ» дүрсний дээрх улаан тоо — уншаагүй зарлалын тоо.
 *
 * Хүн аль ч хуудсан дээр байсан шинэ мэдээ байгааг мэднэ. Уншмагц
 * (карт харагдах, зарлал нээх) тоо шууд буурна.
 */
export function NewsBadge({ stamps, className = '' }: { stamps: NewsStamp[]; className?: string }) {
  const unseen = useUnseen(stamps);
  const count = unseen?.length ?? 0;
  if (count === 0) return null;

  return (
    <span
      className={`grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white ${className}`}
    >
      {count > 9 ? '9+' : count}
      <span className="sr-only"> шинэ зарлал</span>
    </span>
  );
}
