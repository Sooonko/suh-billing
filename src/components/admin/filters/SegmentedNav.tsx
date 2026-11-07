'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useTransition, useState } from 'react';
import { useFilterDraft } from './FilterDraft';

/**
 * Сегмент товч — 2–5 сонголтын хооронд шилжих.
 *
 * `<select>`-ийн оронд ЯАГААД: сонголтууд бүгд нүдэн дээр харагдана,
 * админ юу сонгосныг нэг харцаар мэднэ, бас нэг дарахад шилждэг.
 *
 * ⚠️ `useTransition` ЗААВАЛ хэрэгтэй. Supabase хол байгаа тул дата
 * иртэл 1–2 секунд болдог. Өмнө нь энгийн `<Link>` байсан тул дарахад
 * ямар ч тэмдэг гарахгүй, «дарсан уу, үгүй юу» гэж эргэлзэж дахин
 * дардаг байв. `loading.tsx` нь ЗӨВХӨН хуудас солиход ажилладаг —
 * нэг хуудсан дээр шүүлт солиход тус болохгүй.
 *
 * `href` хэвээр үлдээсэн: гар утасны дунд товч, шинэ цонхонд нээх зэрэг
 * хөтчийн энгийн үйлдлүүд ажилласаар байна.
 *
 * Шүүлтүүрийн картан дотор (`FilterDraft`) байвал дарахад ШУУД шүүхгүй —
 * сонголтыг тэмдэглээд «Шүүх» товчийг хүлээнэ. `href`-ээс аль параметр
 * өөрчлөгдөхийг өөрөө ялгана — хуудаснууд өөрчлөгдөх шаардлагагүй.
 */
export function SegmentedNav({
  items,
}: {
  items: { key: string; label: string; href: string; active: boolean }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const draft = useFilterDraft();
  const [pending, startTransition] = useTransition();
  /** Аль товчийг дарсан бэ — тэр дээр нь л тэмдэг гаргана */
  const [clicked, setClicked] = useState<string | null>(null);
  /** Ноорогт сонгосон (хэрэгжээгүй) товч */
  const [staged, setStaged] = useState<string | null>(null);
  const paramsKey = params.toString();
  useEffect(() => setStaged(null), [paramsKey]);
  // Ноорог хоосорвол (хэрэгжсэн эсвэл URL өөрчлөгдсөн) сонголт ч арилна
  const draftEmpty = draft !== null && !draft.dirty;
  useEffect(() => {
    if (draftEmpty) setStaged(null);
  }, [draftEmpty]);

  /** Энэ товч URL-ын аль параметрийг юу болгох вэ — одоогийн URL-тай харьцуулж */
  function patchFor(href: string) {
    const target = new URL(href, 'http://local').searchParams;
    const patch: Record<string, string | null> = {};
    for (const key of new Set([...target.keys(), ...params.keys()])) {
      if (key === 'page') continue;
      if (target.get(key) !== params.get(key)) patch[key] = target.get(key);
    }
    return patch;
  }

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/70 p-1">
      {items.map((item) => {
        const busy = pending && clicked === item.key;
        const active = staged ? staged === item.key : item.active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            aria-busy={busy || undefined}
            onClick={(e) => {
              // Хөтчийн тусгай үйлдлийг (шинэ цонх, татах) хөндөхгүй
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              if (draft) {
                setStaged(item.key);
                draft.stage(patchFor(item.href));
                return;
              }
              setClicked(item.key);
              startTransition(() => router.push(item.href));
            }}
            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
              active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            } ${pending && !busy ? 'opacity-60' : ''}`}
          >
            {busy && (
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 animate-spin">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
