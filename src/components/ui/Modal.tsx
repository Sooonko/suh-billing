'use client';

import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Бүх popup-ын НЭГ загвар.
 *
 * ЯАГААД: өмнө нь цонх бүр өөр өөрөөр хийгдсэн байв — нэг нь өөрийн
 * цонхтой, нэг нь хүснэгтэд шахагдсан маягттай, найм нь браузерын саарал
 * `confirm()`. Харагдах байдал, хаах арга, товчны байрлал бүгд зөрдөг байсан.
 *
 * Энэ цонх:
 *  · `document.body` руу portal-аар гарна — хүснэгтийн нүд, `overflow`
 *    бүхий хайрцаг дотроос нээгдсэн ч тайрагдахгүй
 *  · Esc, гадуур дарахад хаагдана (ажил явж байхад хаагдахгүй)
 *  · Tab товч цонхноос гарахгүй, хаагдахад фокус товч руугаа буцна
 *  · Цаад хуудас гүйхгүй (scroll түгжинэ)
 *  · Гар утсан дээр доороос гарч ирнэ — эрхий хуруунд ойр
 */

const SIZE = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const;

/** Товчны нэгдсэн загвар — цонхны доод мөрөнд */
export const BUTTON = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50',
  success:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
} as const;

/** Маягтын талбарын нэгдсэн загвар */
export const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

/** Цонх доторх алдааны мөр */
export function ModalError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-4 flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <span aria-hidden>⚠</span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * Нээлттэй цонхнуудын овоо — Esc дарахад ЗӨВХӨН хамгийн дээд нь хаагдана.
 * Жишээ: оноох цонхны дээр баталгаажуулах цонх нээгдсэн бол.
 */
const stack: string[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Гарчгийн доорх саарал мөр — огноо, дүн г.м. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Доод мөрийн товчнууд. Анхдагч товчийг ЭХЭНД нь бичнэ. */
  footer?: React.ReactNode;
  size?: keyof typeof SIZE;
  /** Ажил явж байхад Esc, гадуур дарах, ✕ товч хаахгүй */
  busy?: boolean;
  /** Өгвөл агуулга ба товчнууд `<form>` дотор орж, Enter дарахад илгээнэ */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Хаалт нь эффектийн хамаарал болохгүйн тулд ref-д хадгална — эс бөгөөс
  // эцэг компонент дахин зурагдах бүрт фокус эхний талбар руу үсэрнэ
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  /** Гадуур дарсан эсэх — дотор нь текст сонгоод гадна суллахад хаагдахгүй */
  const pressedOutside = useRef(false);

  useEffect(() => {
    if (!open) return;

    stack.push(id);
    const previous = document.activeElement as HTMLElement | null;

    // Цаад хуудсыг түгжинэ. Олон цонх давхцаж болох тул хуучин утгыг хадгална.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Эхний фокус: `data-autofocus` → эхний талбар → цонх өөрөө
    const node = panel.current;
    const target =
      node?.querySelector<HTMLElement>('[data-autofocus]') ??
      node?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select, textarea') ??
      node;
    target?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
        return;
      }

      // Фокусыг цонх дотор эргэлдүүлнэ
      if (event.key === 'Tab' && node) {
        const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => el.offsetParent !== null,
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      const index = stack.lastIndexOf(id);
      if (index !== -1) stack.splice(index, 1);
      document.body.style.overflow = prevOverflow;
      // Фокусыг нээсэн товч руу нь буцаана — гараар ажилладаг хүн байршлаа алдахгүй
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open, id]);

  if (!open || typeof document === 'undefined') return null;

  const content = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:pb-3.5">
          {footer}
        </div>
      )}
    </>
  );

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] motion-safe:animate-fade-in sm:items-center sm:p-4"
      onMouseDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedOutside.current && !busy) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white text-left shadow-2xl outline-none motion-safe:animate-modal-in sm:rounded-2xl ${SIZE[size]}`}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-lg font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={`${id}-desc`} className="mt-0.5 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Хаах"
            className="-mr-2 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {content}
          </form>
        ) : (
          content
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Товч дээрх эргэлдэх дүрс — «Хадгалж байна…» гэхэд хамт */
export function Spinner() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
