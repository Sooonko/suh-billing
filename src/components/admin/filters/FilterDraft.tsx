'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { createContext, useContext, useEffect, useState, useTransition } from 'react';

/**
 * Шүүлтийг «Шүүх» дарах хүртэл ХҮЛЭЭЛГЭНЭ.
 *
 * ЯАГААД: өмнө нь Данс, Төлөв, Сар дээр дарах БҮРТ хуудас дахин
 * ачаалагддаг байв. Supabase хол тул нэг бүр нь 1–2 секунд — «Ус, дулаан»
 * → «Дутуу» → «9 сар» гэж гурав дарахад гурван удаа хүлээнэ. Бас
 * ачаалах үед товч дотор эргэлдэх тэмдэг гарч, товч өргөсөж, мөр доош
 * унаж загвар эвдэрдэг байв.
 *
 * Одоо сонголтууд энд хадгалагдаж, «Шүүх» (эсвэл хайлтад Enter) нэг л
 * удаа хэрэгжүүлнэ.
 *
 * `null` утга = тухайн параметрийг URL-аас хасна.
 */
type Patch = Record<string, string | null>;

interface FilterDraftValue {
  /** Хэрэгжээгүй өөрчлөлтүүд */
  draft: Patch;
  stage: (patch: Patch) => void;
  /** Ноорогийг (нэмэлт өөрчлөлттэй хамт) URL-д хэрэгжүүлнэ */
  apply: (extra?: Patch) => void;
  /** Хэрэгжээгүй өөрчлөлт байгаа эсэх */
  dirty: boolean;
  pending: boolean;
}

const FilterDraftContext = createContext<FilterDraftValue | null>(null);

/** Шүүлтүүрийн картанд байвал утгатай, гадна нь null — компонентууд шууд навигацдаа буцна */
export const useFilterDraft = () => useContext(FilterDraftContext);

export function FilterDraftProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const paramsKey = params.toString();
  const [draft, setDraft] = useState<Patch>({});
  const [pending, startTransition] = useTransition();

  // URL өөрчлөгдвөл (хэрэгжсэн, эсвэл буцах товч) ноорог хуучирна
  useEffect(() => setDraft({}), [paramsKey]);

  const stage = (patch: Patch) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      // URL-тай ижил болсон түлхүүрийг ноорогоос хасна — «өөрчлөлт байна»
      // гэсэн тэмдэг худлаа асахгүй
      for (const [key, value] of Object.entries(next)) {
        if ((params.get(key) ?? null) === (value || null)) delete next[key];
      }
      return next;
    });
  };

  const apply = (extra: Patch = {}) => {
    const next = new URLSearchParams(paramsKey);
    for (const [key, value] of Object.entries({ ...draft, ...extra })) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Шүүлт өөрчлөгдвөл 1-р хуудас руу — эс бөгөөс хэтэрсэн хуудас хоосон гарна
    next.delete('page');
    startTransition(() => router.push(`?${next.toString()}`));
  };

  return (
    <FilterDraftContext.Provider
      value={{ draft, stage, apply, dirty: Object.keys(draft).length > 0, pending }}
    >
      {children}
    </FilterDraftContext.Provider>
  );
}

/**
 * Сар сонгогчид — ноорогт сонгосон сар. Картаас гадна бол null (шууд шүүнэ).
 * `month` нь ноорогт байвал тэр, үгүй бол URL-ын одоогийн сар.
 */
export function useStagedMonth(current: string | null) {
  const ctx = useFilterDraft();
  if (!ctx) return null;
  const month = 'month' in ctx.draft ? (ctx.draft.month ?? null) : current;
  return { month, set: (value: string | null) => ctx.stage({ month: value }) };
}
