'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Энгийн сонгох жагсаалт — <select>-тэй ИЖИЛ харагдана.
 *
 * ЯАГААД <select> биш вэ: хөтчийн өөрийн нээгддэг цонх утсан дээр (Chrome-ын
 * утасны горим, зарим WebView) жижигхэн, хуудасны дээгүүр буруу байрлалд
 * гарч «загвар эвдэрсэн» мэт харагдаж байв. Энэ жагсаалтыг бид өөрсдөө
 * зурдаг тул хаана ч ижил харагдана.
 */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  /** Дэлгэц уншигчид — «Сар», «Ангилал» */
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Гадна дарах эсвэл Esc → хаана
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value)?.label ?? '';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none ${
          open ? 'border-slate-900' : 'border-slate-300'
        }`}
      >
        {current}
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute left-0 z-20 mt-1 max-h-72 min-w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value || '__all'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-4 whitespace-nowrap px-3 py-2.5 text-left text-sm ${
                    selected ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                  {selected && <span className="text-slate-900">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
