'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatBillingMonth } from '@/lib/format';

/**
 * Сар сонгогч — бүх админ дэлгэцэд НЭГ загвар.
 *
 * ЯАГААД `<input type="month">`-ыг СОЛИВ:
 *  · Safari, Firefox дээр сар сонгох цонх ОГТ гардаггүй — жирийн текст
 *    талбар болж, хүн «2026-09» гэж гараар бичих болдог
 *  · Chrome дээр «September 2026» гэж англиар харагддаг
 *  · Хуудас бүр өөр загвартай (нэг нь input, нөгөө нь select) байв
 *
 * Энэ сонгогч: товч дээр «2026 оны 9 сар», дарахад ‹ 2026 › он солих
 * мөр ба 12 сарын хүснэгт. Дата байгаа сар ногоон цэгтэй.
 *
 * Цонх нь `document.body` руу portal-аар гарна — Modal-ын гүйлгэдэг
 * хэсэг дотор байсан ч тайрагдахгүй.
 */

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Одоогийн сар — 'YYYY-MM', хэрэглэгчийн цагийн бүсээр */
export function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const key = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** 'YYYY-MM' → +/- n сар */
export function shiftMonth(value: string, delta: number): string {
  const [y, m] = value.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return key(Math.floor(total / 12), (total % 12) + 1);
}

export function MonthInput({
  value,
  onChange,
  marked,
  selectable,
  allowEmpty = false,
  emptyLabel = 'Бүх хугацаа',
  placeholder = 'Сар сонгох',
  size = 'filter',
  id,
  ariaLabel = 'Сар',
  disabled = false,
}: {
  /** 'YYYY-MM' эсвэл null (сонгоогүй / бүх хугацаа) */
  value: string | null;
  onChange: (month: string | null) => void;
  /** Дата байгаа сарууд — ногоон цэгээр тэмдэглэнэ */
  marked?: string[];
  /** Өгвөл ЗӨВХӨН эдгээр сарыг сонгож болно (бусад нь бүдэг) */
  selectable?: string[];
  /** «Бүх хугацаа» сонголт */
  allowEmpty?: boolean;
  emptyLabel?: string;
  placeholder?: string;
  /** `filter` — шүүлтүүрийн мөрөнд (h-9), `field` — маягтын талбар (бүтэн өргөн) */
  size?: 'filter' | 'field';
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const allowed = selectable ? new Set(selectable) : null;
  const hasData = new Set(marked ?? selectable ?? []);

  // Он солих хүрээ — сонгох боломжтой сарууд байвал түүгээр хязгаарлана
  const nowYear = new Date().getFullYear();
  const years = (selectable ?? []).map((m) => Number(m.slice(0, 4)));
  const minYear = allowed && years.length ? Math.min(...years) : 2020;
  const maxYear = allowed && years.length ? Math.max(...years) : nowYear + 1;

  const [year, setYear] = useState(() => Number((value || selectable?.[0] || thisMonth()).slice(0, 4)));

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  function toggle() {
    if (open) return close();
    // Нээх бүрт сонгосон сарын он руу буцна
    setYear(Number((value || selectable?.[0] || thisMonth()).slice(0, 4)));
    setOpen(true);
  }

  function pick(month: string | null) {
    onChange(month);
    close();
  }

  // Байрлал: товчны доор, зай хүрэхгүй бол дээр. Гүйлгэх, хэмжээ өөрчлөхөд дагана.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      const box = panel.current;
      if (!rect || !box) return;
      const width = box.offsetWidth;
      const height = box.offsetHeight;
      const below = rect.bottom + 6;
      const top = below + height > window.innerHeight - 8 && rect.top - height - 6 > 8 ? rect.top - height - 6 : below;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPosition({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Гадуур дарахад хаагдана
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  // Нээгдэхэд сонгосон (эсвэл эхний боломжтой) сар руу фокус
  useEffect(() => {
    if (!open) return;
    const node = panel.current;
    (node?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      node?.querySelector<HTMLElement>('[data-month]:not([disabled])'))?.focus();
  }, [open, year]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      // Modal доторх бол зөвхөн энэ цонх хаагдана, Modal биш
      event.stopPropagation();
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      close();
      return;
    }
    // Сумаар сар хооронд шилжинэ
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
    if (step === undefined) return;
    const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[data-month]') ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();
    const next = index + step;
    if (next < 0 && year > minYear) setYear(year - 1);
    else if (next > 11 && year < maxYear) setYear(year + 1);
    else buttons[Math.max(0, Math.min(11, next))]?.focus();
  }

  const current = thisMonth();
  const label = value ? formatBillingMonth(value) : allowEmpty ? emptyLabel : placeholder;

  const triggerClass =
    size === 'field'
      ? 'flex w-full items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-slate-400 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/10'
      : 'flex h-9 min-w-44 items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm outline-none transition hover:border-slate-400 focus-visible:border-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/10';

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        onClick={toggle}
        aria-label={`${ariaLabel}: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-50 ${open ? 'border-slate-900 ring-2 ring-slate-900/10' : ''}`}
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-slate-400">
          <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        </svg>
        <span className={`flex-1 truncate font-medium ${value ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}>
          <path d="M5.2 7.2a.75.75 0 0 1 1.06 0L10 10.94l3.74-3.74a.75.75 0 1 1 1.06 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0L5.2 8.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label="Сар сонгох"
            onKeyDown={onKeyDown}
            style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
            className="fixed z-[70] w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl motion-safe:animate-fade-in"
          >
            {/* Он солих */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setYear(year - 1)}
                disabled={year <= minYear}
                aria-label="Өмнөх он"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
              >
                ‹
              </button>
              <span className="text-sm font-bold tabular-nums text-slate-900">{year} он</span>
              <button
                type="button"
                onClick={() => setYear(year + 1)}
                disabled={year >= maxYear}
                aria-label="Дараах он"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
              >
                ›
              </button>
            </div>

            {/* 12 сар */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m) => {
                const k = key(year, m);
                const selected = k === value;
                const enabled = !allowed || allowed.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    data-month={k}
                    disabled={!enabled}
                    aria-pressed={selected}
                    aria-label={`${formatBillingMonth(k)}${hasData.has(k) ? ', дата байгаа' : ''}`}
                    onClick={() => pick(k)}
                    className={`relative h-10 rounded-lg text-sm font-semibold tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-slate-900/40 disabled:cursor-not-allowed disabled:text-slate-300 ${
                      selected
                        ? 'bg-slate-900 text-white'
                        : k === current
                          ? 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-100'
                          : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {m} сар
                    {hasData.has(k) && (
                      <span
                        aria-hidden
                        className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                          selected ? 'bg-emerald-300' : 'bg-emerald-500'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Товчлол */}
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
              {(!allowed || allowed.has(current)) && (
                <button
                  type="button"
                  onClick={() => pick(current)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Энэ сар
                </button>
              )}
              {allowEmpty && (
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition hover:bg-slate-100 ${
                    value === null ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {emptyLabel}
                </button>
              )}
              {hasData.size > 0 && (
                <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  дататай
                </span>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
