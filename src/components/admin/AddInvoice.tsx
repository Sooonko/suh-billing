'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BUTTON, Field, INPUT, Modal, ModalError, Spinner } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Feedback';
import { callApi } from '@/lib/api-client';
import { formatMnt } from '@/lib/format';
import { CATEGORY_LABEL, type BillCategory } from '@/lib/types';

/**
 * Нэхэмжлэлийг ГАРААР нэмэх.
 *
 * ЯАГААД: Excel-д мөр нь байхгүй, эсвэл заалт дутуу тул орж ирээгүй айл
 * бүтэн сараар нэхэмжлэлгүй үлддэг. Бүхэл файлыг дахин импорт хийлгүйгээр
 * ганц айлыг нэмэх гарц байх ёстой.
 *
 * ⚠️ Дүнг админ бичихгүй — ЗААЛТЫГ л өгнө, системд бодуулна. Ингэснээр
 * гараар нэмсэн нэхэмжлэл импортоор орсонтой ЯГ ижил дүрмээр бодогдоно.
 * (СӨХ нь тоолуургүй тул тэнд л дүнг шууд бичнэ.)
 */

export function AddInvoice({
  category,
  month,
}: {
  category: BillCategory;
  /** Шүүлтүүрийн сар — маягтын анхдагч утга болно */
  month: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <span aria-hidden className="text-base leading-none">＋</span>
        Нэхэмжлэл нэмэх
      </button>
      {/* Хаагдахад маягт цэвэрлэгдэж, сар нь шүүлтүүрийн утга руугаа буцна —
          дараагийн нэмэлт нь тэр сараас эхлэх нь хамгийн түгээмэл хэрэгцээ */}
      {open && (
        <AddInvoiceDialog category={category} defaultMonth={month} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function AddInvoiceDialog({
  category,
  defaultMonth,
  onClose,
}: {
  category: BillCategory;
  defaultMonth: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Сарыг маягт дотроо ЗАСАЖ болно.
   *
   * ЯАГААД: шүүлтүүрийн сарын цэс нь нэхэмжлэл АЛЬ ХЭДИЙН байгаа
   * саруудыг л харуулдаг. Тиймээс 6, 7 сар шиг огт нэхэмжлэлгүй сард
   * мөр нэмэх гарц байхгүй байв — тэр сар цэсэнд гарч ирдэггүй.
   */
  const [month, setMonth] = useState(defaultMonth);
  const [flatNumber, setFlatNumber] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  /**
   * Заалтгүйгээр дүнг ШУУД бичих горим.
   *
   * ЯАГААД: систем нэвтрүүлэхээс өмнөх хуримтлагдсан өр цаасан дээр нэг
   * дүнгээр л үлдсэн байдаг — тоолуурын заалт нь алга, тэр саруудад тариф ч
   * тохируулаагүй тул бодуулах боломжгүй. Тэр өрийг оруулах цорын ганц гарц.
   *
   * СӨХ нь тоолуургүй тул ХЭДИЙНЭ дүнгээр ордог — тэнд сонголт утгагүй.
   */
  const [direct, setDirect] = useState(false);
  const isDirect = category !== 'SOH' && direct;

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    // Заалтад таслалыг ХАСАХГҮЙ — «123,5» нь аравтын бутархай байж мэднэ.
    // Зөвхөн дүнд «35,000» гэсэн мянгатын таслалыг зөвшөөрнө.
    const num = (key: string) =>
      values[key] === undefined || values[key].trim() === ''
        ? 0
        : Number(key === 'amount' ? values[key].replace(/[,\s₮]/g, '') : values[key].trim());

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      setError('Сарыг зөв сонгоно уу');
      return;
    }
    const flat = Number(flatNumber.trim());
    if (!Number.isInteger(flat) || flat <= 0) {
      setError('Тоотоо зөв оруулна уу');
      return;
    }

    setBusy(true);
    setError(null);

    const result = await callApi<{ flatNumber: number; billAmount: number }>('/api/admin/invoices', {
      method: 'POST',
      json: {
        category,
        billingMonth: month,
        flatNumber: flat,
        note: note || null,
        ...(isDirect
          ? { directAmount: true, billAmount: num('amount') }
          : category === 'WATER_HEAT'
          ? {
              hotPrev: num('hotPrev'),
              hotCurrent: num('hotCurrent'),
              coldPrev: num('coldPrev'),
              coldCurrent: num('coldCurrent'),
            }
          : category === 'ELECTRICITY'
            ? { prevReading: num('prev'), currentReading: num('current') }
            : { billAmount: num('amount') }),
      },
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast(`${result.data.flatNumber ?? flat} тоот — ${formatMnt(result.data.billAmount)} нэхэмжлэл нэмэгдлээ`);
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      size="lg"
      title={`${CATEGORY_LABEL[category]} — нэхэмжлэл нэмэх`}
      description={
        category === 'SOH'
          ? 'СӨХ нь тоолуургүй тул дүнг шууд бичнэ.'
          : isDirect
            ? 'Бичсэн дүн шууд өр болно — систем бодохгүй.'
            : 'Дүнг систем заалтаас бодно — импортоор орсонтой ижил дүрмээр.'
      }
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={BUTTON.secondary}>
            Болих
          </button>
          <button type="submit" disabled={busy} className={BUTTON.primary}>
            {busy && <Spinner />}
            {busy ? 'Нэмж байна…' : 'Нэмэх'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Сар">
          <input
            required
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Тоот">
          <input
            required
            data-autofocus
            inputMode="numeric"
            value={flatNumber}
            onChange={(e) => setFlatNumber(e.target.value)}
            placeholder="109"
            className={INPUT}
          />
        </Field>

        {isDirect && (
          <Field label="Дүн (₮)">
            <input
              required
              inputMode="numeric"
              value={values.amount ?? ''}
              onChange={set('amount')}
              placeholder="106912"
              className={INPUT}
            />
          </Field>
        )}

        {!isDirect && category === 'WATER_HEAT' && (
          <>
            <Field label="Халуун өмнөх">
              <input inputMode="decimal" value={values.hotPrev ?? ''} onChange={set('hotPrev')} className={INPUT} />
            </Field>
            <Field label="Халуун одоо">
              <input inputMode="decimal" value={values.hotCurrent ?? ''} onChange={set('hotCurrent')} className={INPUT} />
            </Field>
            <Field label="Хүйтэн өмнөх">
              <input inputMode="decimal" value={values.coldPrev ?? ''} onChange={set('coldPrev')} className={INPUT} />
            </Field>
            <Field label="Хүйтэн одоо">
              <input inputMode="decimal" value={values.coldCurrent ?? ''} onChange={set('coldCurrent')} className={INPUT} />
            </Field>
          </>
        )}

        {!isDirect && category === 'ELECTRICITY' && (
          <>
            <Field label="Өмнөх заалт">
              <input inputMode="decimal" value={values.prev ?? ''} onChange={set('prev')} className={INPUT} />
            </Field>
            <Field label="Одоогийн заалт">
              <input inputMode="decimal" value={values.current ?? ''} onChange={set('current')} className={INPUT} />
            </Field>
          </>
        )}

        {category === 'SOH' && (
          <Field label="Дүн (₮)">
            <input required inputMode="numeric" value={values.amount ?? ''} onChange={set('amount')} className={INPUT} />
          </Field>
        )}

        <div className="sm:col-span-2">
          <Field label={isDirect ? 'Тэмдэглэл (заавал)' : 'Тэмдэглэл'}>
            <input
              required={isDirect}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isDirect ? '5,6,7 сарын өр' : 'Excel-д байгаагүй'}
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      {/*
        Заалтгүй горимыг талбаруудын ДООР тавив: энгийн тохиолдолд заалтаар
        бодуулах нь зөв, энэ нь ховор гарц тул анхаарлыг нь сарниулах ёсгүй.
      */}
      {category !== 'SOH' && (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={direct}
            onChange={(e) => setDirect(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
          />
          <span className="text-sm leading-snug text-slate-700">
            Заалтгүйгээр <b>дүнг шууд бичих</b>
            <span className="block text-xs text-slate-500">
              Систем нэвтрүүлэхээс өмнөх хуримтлагдсан өр оруулахад. Тоолуурын заалт
              шаардахгүй, тариф ч хэрэггүй.
            </span>
          </span>
        </label>
      )}

      <ModalError>{error}</ModalError>
    </Modal>
  );
}
