'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

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
 *
 * Үйлдлийг ҮГЭЭР бичнэ — «Харах →», шүүлттэй үед «✕ Бүгдийг харах».
 * Өмнө нь зөвхөн жижиг ✕ байсан тул шүүлтээс яаж гарахыг ойлгодоггүй байв.
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
  const router = useRouter();
  // Чип нь шүүлт болдог тул дарахад дата шинээр татагдана — 1–2 секунд
  const [pending, startTransition] = useTransition();

  if (count === 0) return null;

  const body = (
    <>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-4 w-4 shrink-0"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v.01M12 11v5" strokeLinecap="round" />
      </svg>
      <span>
        <span className="font-bold tabular-nums">{count}</span> {label}
      </span>
      {href &&
        (pending ? (
          <svg viewBox="0 0 24 24" fill="none" className="ml-1 h-3.5 w-3.5 animate-spin">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : active ? (
          <span className="ml-2 rounded-md bg-amber-900 px-2 py-0.5 text-xs font-semibold text-white">
            ✕ Бүгдийг харах
          </span>
        ) : (
          <span className="ml-2 font-semibold text-amber-800 underline decoration-amber-400 underline-offset-2">
            Харах →
          </span>
        ))}
    </>
  );

  const tone = active
    ? 'border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-300'
    : 'border-amber-300 bg-amber-50 text-amber-900';
  const shell = `inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium ${tone}`;

  if (!href) return <span className={shell}>{body}</span>;

  return (
    <Link
      href={href}
      aria-pressed={active}
      aria-busy={pending || undefined}
      title={active ? 'Шүүлтийг цуцлаад бүгдийг харах' : `Эдгээр ${count}-ыг л харах`}
      onClick={(e) => {
        // Хөтчийн тусгай үйлдлийг хөндөхгүй
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        startTransition(() => router.push(href));
      }}
      className={`${shell} transition hover:border-amber-400 hover:bg-amber-100`}
    >
      {body}
    </Link>
  );
}
