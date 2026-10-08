'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BUTTON, Modal, ModalError, Spinner } from './Modal';

/**
 * Баталгаажуулах цонх ба богино мэдэгдэл (toast) — админы бүх дэлгэцэд.
 *
 * `confirm()`-ыг ОРЛОНО. Браузерын цонх нь саарал, монгол үсгийг муу
 * харуулдаг, гүйлгээний утга шиг урт текстийг тайрдаг, утсан дээр огт
 * өөрөөр харагддаг байв.
 *
 * Хэрэглэх нь:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: '…', tone: 'danger', action: async () => { … } });
 *
 * `action` өгвөл ажлыг ЦОНХ ДОТОР гүйцэтгэнэ: товч «…» болж эргэлдэнэ,
 * алдаа гарвал цонх хаагдахгүй, алдааг дотроо харуулна. Ингэснээр админ
 * «дарсан, юу ч болсонгүй» гэж төөрөхгүй.
 */

export type ConfirmTone = 'danger' | 'primary' | 'success';

export interface ConfirmOptions {
  title: string;
  /** Гол тайлбар */
  message?: React.ReactNode;
  /** Гүйлгээний утга шиг ишлэл — саарал хайрцагт бүтнээр нь */
  quote?: string;
  /** «Тоот: 107» гэх мэт мөрүүд */
  details?: [string, React.ReactNode][];
  /** Шар анхааруулга — буцаах боломжгүй г.м. */
  warning?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /**
   * Баталгаажсаны дараах ажил. Алдааны мессеж буцаавал цонх нээлттэй
   * үлдэж, түүнийг харуулна. Юу ч буцаахгүй бол амжилттай гэж үзнэ.
   */
  action?: () => Promise<string | void | null | undefined>;
}

export type ToastTone = 'success' | 'error' | 'info';

interface FeedbackApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, tone?: ToastTone) => void;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

/**
 * Provider-гүй газар (жишээ нь шинэ хуудсанд мартсан) ажил зогсохгүйн
 * тулд браузерын цонх руу буцна.
 */
const fallback: FeedbackApi = {
  async confirm(options) {
    const text = [options.title, typeof options.message === 'string' ? options.message : '', options.quote ?? '']
      .filter(Boolean)
      .join('\n\n');
    if (!window.confirm(text)) return false;
    const error = await options.action?.();
    if (error) {
      window.alert(error);
      return false;
    }
    return true;
  },
  toast(message) {
    console.info(message);
  },
};

export function useConfirm() {
  return (useContext(FeedbackContext) ?? fallback).confirm;
}

export function useToast() {
  return (useContext(FeedbackContext) ?? fallback).toast;
}

interface Pending {
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const TONE_BUTTON: Record<ConfirmTone, string> = {
  danger: BUTTON.danger,
  primary: BUTTON.primary,
  success: BUTTON.success,
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending((previous) => {
          // Өмнөх нь хариугүй үлдвэл хүлээж буй код мөнхөд гацна
          previous?.resolve(false);
          return { options, resolve };
        });
        setBusy(false);
        setError(null);
      }),
    [],
  );

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, message, tone }]);
  }, []);

  // Тогтмол функц — эс бөгөөс шинэ мэдэгдэл ирэх бүрт хуучны таймер дахин эхэлнэ
  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  function cancel() {
    if (busy) return;
    pending?.resolve(false);
    setPending(null);
  }

  async function accept() {
    if (!pending || busy) return;
    const { options, resolve } = pending;
    if (options.action) {
      setBusy(true);
      setError(null);
      let failure: string | void | null | undefined;
      try {
        failure = await options.action();
      } catch {
        failure = 'Алдаа гарлаа. Дахин оролдоно уу.';
      }
      setBusy(false);
      if (failure) {
        setError(failure);
        return;
      }
    }
    resolve(true);
    setPending(null);
  }

  const options = pending?.options;
  const tone = options?.tone ?? 'primary';

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {children}

      <Modal
        open={pending !== null}
        onClose={cancel}
        busy={busy}
        size="sm"
        title={
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${
                tone === 'danger'
                  ? 'bg-red-100 text-red-700'
                  : tone === 'success'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              {tone === 'danger' ? '!' : '?'}
            </span>
            {options?.title}
          </span>
        }
        footer={
          <>
            {/* Устгах төрлийн үйлдэлд фокус «Болих» дээр — санамсаргүй Enter дарахад юу ч устахгүй */}
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              data-autofocus={tone === 'danger' ? true : undefined}
              className={BUTTON.secondary}
            >
              {options?.cancelLabel ?? 'Болих'}
            </button>
            <button
              type="button"
              onClick={accept}
              disabled={busy}
              data-autofocus={tone === 'danger' ? undefined : true}
              className={TONE_BUTTON[tone]}
            >
              {busy && <Spinner />}
              {options?.confirmLabel ?? 'Тийм'}
            </button>
          </>
        }
      >
        {options?.message && <div className="text-sm leading-relaxed text-slate-600">{options.message}</div>}

        {options?.quote && (
          <p className="mt-3 wrap-break-word rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {options.quote}
          </p>
        )}

        {options?.details && options.details.length > 0 && (
          <dl className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {options.details.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 px-3 py-2">
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="text-right text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {options?.warning && (
          <p className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
            <span aria-hidden>⚠️</span>
            <span>{options.warning}</span>
          </p>
        )}

        <ModalError>{error}</ModalError>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </FeedbackContext.Provider>
  );
}

const TOAST_STYLE: Record<ToastTone, { box: string; icon: string }> = {
  success: { box: 'bg-slate-900 text-white', icon: '✓' },
  error: { box: 'bg-red-600 text-white', icon: '!' },
  info: { box: 'bg-slate-800 text-white', icon: 'i' },
};

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
    >
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    // Алдааг удаан харуулна — уншиж амжих ёстой
    const timer = setTimeout(() => onDismiss(item.id), item.tone === 'error' ? 7000 : 3500);
    return () => clearTimeout(timer);
  }, [item.id, item.tone, onDismiss]);

  const style = TOAST_STYLE[item.tone];
  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg motion-safe:animate-toast-in ${style.box}`}
    >
      <span aria-hidden className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-bold">
        {style.icon}
      </span>
      <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Хаах"
        className="-mr-1 shrink-0 rounded px-1 text-white/60 transition hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
