'use client';

import { useState } from 'react';
import { formatMnt } from '@/lib/format';
import { CATEGORIES, type BillCategory } from '@/lib/types';
import { readSheets, type SheetData } from '@/lib/read-sheet';

/**
 * Нэхэмжлэлийн Excel импорт — 2 алхамтай.
 *
 *   Файл сонгох → PREVIEW (DB-д юу ч бичихгүй) → админ хараад → COMMIT
 *
 * Excel-ийг БРАУЗЕР дээр уншина. Ингэснээр Vercel-ийн 10 секундын хязгаарт
 * ойртохгүй, сервер рүү зөвхөн жижиг JSON явна.
 */

interface BillLine {
  code: string;
  label: string;
  unit: string;
  rate: number;
  qty: number;
  amount: number;
}

interface PreviewRow {
  rowIndex: number;
  sheet: string;
  flatNumber: number;
  prevReading: number | null;
  currentReading: number | null;
  usageAmount: number | null;
  billAmount: number;
  isReplacing: boolean;
  // ── зөвхөн ус дулаанд ──
  hotPrev?: number;
  hotCurrent?: number;
  coldPrev?: number;
  coldCurrent?: number;
  breakdown?: BillLine[];
}

interface TariffRow {
  code: string;
  label: string;
  unit: string;
  rate: number;
}

interface Preview {
  category: BillCategory;
  billingMonth: string;
  columns: Record<string, string | undefined>;
  /** Ус дулаанд ямар тариф хэрэглэсэн бэ */
  tariffs: TariffRow[];
  sheetSummary: { name: string; rows: number; imported: number }[];
  duplicateFlats: { flatNumber: number; sheets: string[] }[];
  summary: {
    willImport: number;
    willReplace: number;
    unknownFlats: number;
    skipped: number;
    duplicateFlats: number;
    totalAmount: number;
  };
  rows: PreviewRow[];
  skipped: { sheet: string; rowIndex: number; raw: string; reason: string }[];
  unknownFlats: { sheet: string; rowIndex: number; flatNumber: number }[];
}

interface CommitResult {
  imported: number;
  replaced: number;
  unknownFlats: number;
  skipped: number;
  totalAmount: number;
}

/** Өнөөдрийн сар — "2026-09" */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function InvoiceImport() {
  const [category, setCategory] = useState<BillCategory>('WATER_HEAT');
  /** Ус дулаан бусдаас өөр — 4 заалт уншиж, системээ бодно */
  const isWater = category === 'WATER_HEAT';
  const [billingMonth, setBillingMonth] = useState(currentMonth());
  const [fileName, setFileName] = useState<string | null>(null);
  /** Файлын бүх таб — СӨХ нэхэмжлэлээ орцоор хуваадаг («1 орц», «2 орц») */
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'read' | 'preview' | 'commit' | null>(null);

  function reset() {
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    reset();
    setBusy('read');
    setFileName(file.name);

    try {
      const parsed = (await readSheets(file)).filter((sheet) => sheet.rows.length > 0);
      setSheets(parsed);
      if (!parsed.length) setError('Файл хоосон байна');
    } catch {
      setError('Excel файл уншигдсангүй. .xlsx эсвэл .csv байх ёстой.');
      setSheets(null);
    } finally {
      setBusy(null);
    }
  }

  async function send(step: 'preview' | 'commit') {
    if (!sheets) return;
    setBusy(step);
    setError(null);

    const response = await fetch(`/api/admin/invoices/${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, billingMonth, sheets }),
    });
    const data = await response.json();
    setBusy(null);

    if (!response.ok) {
      setError(data.error ?? 'Алдаа гарлаа');
      return;
    }

    if (step === 'preview') setPreview(data as Preview);
    else {
      setResult(data as CommitResult);
      setPreview(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Тохиргоо ба файл ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
          1. Ангилал, сар, файл
        </h2>

        <div className="mb-4">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Ангилал</span>
          <div className="flex flex-wrap gap-2">
            {/* СӨХ энд БАЙХГҮЙ — тоолуургүй тул Excel импорт хэрэггүй,
                дээрх «СӨХ-ийн сарын хураамж» хэсгээс үүсгэнэ. */}
            {CATEGORIES.filter((c) => c.key !== 'SOH').map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategory(key);
                  reset();
                }}
                aria-pressed={category === key}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  category === key
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 max-w-xs">
          <label htmlFor="month" className="mb-1.5 block text-sm font-medium text-slate-700">
            Тооцооны сар
          </label>
          <input
            id="month"
            type="month"
            value={billingMonth}
            onChange={(e) => {
              setBillingMonth(e.target.value);
              reset();
            }}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
          />
        </div>

        <div>
          <label htmlFor="file" className="mb-1.5 block text-sm font-medium text-slate-700">
            Excel файл
          </label>
          <input
            id="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="block w-full cursor-pointer rounded-lg border border-slate-300 text-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
          {category === 'WATER_HEAT' ? (
            <p className="mt-2 text-xs text-slate-500">
              Толгой мөрөнд <span className="font-semibold">Тоот</span>, мөн{' '}
              <span className="font-semibold">«Халуун ус … заалт»</span> ба{' '}
              <span className="font-semibold">«Хүйтэн ус … заалт»</span> тус бүр ХОЁР багана
              (өмнөх сар, энэ сар) байх ёстой. Зөрүү, төлбөр, НӨАТ багануудыг{' '}
              <span className="font-semibold">уншихгүй</span> — системээ өөрөө бодно.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Толгой мөрөнд <span className="font-semibold">Тоот</span> ба{' '}
              <span className="font-semibold">Дүн</span> багана байх ёстой. Өмнөх заалт, одоогийн
              заалт, зарцуулалт, тайлбар нь байвал уншина.
            </p>
          )}
          {fileName && sheets && (
            <div className="mt-2 text-sm text-slate-600">
              <p>
                📄 {fileName} — <span className="font-semibold">{sheets.length}</span> таб
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                {sheets.map((sheet) => (
                  <li key={sheet.name}>
                    «{sheet.name}» — {sheet.rows.length} мөр (толгой {sheet.headerRow}-р мөрөнд)
                  </li>
                ))}
              </ul>
              {sheets.length > 1 && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Бүх табыг НЭГТГЭЖ оруулна — тоот байр даяар давхардахгүй тул орц хамаагүй.
                </p>
              )}
            </div>
          )}
        </div>

        {sheets && sheets.length > 0 && !preview && !result && (
          <button
            type="button"
            onClick={() => send('preview')}
            disabled={busy !== null}
            className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {busy === 'preview' ? 'Шалгаж байна…' : 'Шалгах (DB-д бичихгүй)'}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── 2. Шалгалтын үр дүн ───────────────────────────────────────────── */}
      {preview && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            2. Шалгалтын үр дүн
          </h2>

          {preview.sheetSummary.length > 1 && (
            <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
              {preview.sheetSummary.map((sheet) => (
                <li key={sheet.name}>
                  «{sheet.name}»: <span className="font-bold tabular-nums">{sheet.imported}</span>/
                  {sheet.rows} мөр
                </li>
              ))}
            </ul>
          )}

          {preview.duplicateFlats.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">
                ⛔ Нэг тоот хоёр табад давхардаж байна — бүртгэх боломжгүй
              </p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {preview.duplicateFlats.map((d) => (
                  <li key={d.flatNumber}>
                    тоот {d.flatNumber}: {d.sheets.join(', ')}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Excel файлаа шалгана уу. Аль нь зөв бэ гэдгийг систем шийдэхгүй.
              </p>
            </div>
          )}

          {/* Ямар багана танисан — андуурсныг эндээс шууд мэдэнэ */}
          <dl className="mb-4 flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
            {Object.entries(preview.columns)
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="inline font-medium text-slate-400">{key}: </dt>
                  <dd className="inline font-mono">{value}</dd>
                </div>
              ))}
          </dl>

          {preview.tariffs.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
                Хэрэглэсэн тариф ({preview.billingMonth})
              </p>
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-amber-900">
                {preview.tariffs.map((t) => (
                  <li key={t.code}>
                    {t.label}:{' '}
                    <span className="font-bold tabular-nums">
                      {t.rate}
                      {t.unit === 'PER_M3' ? '₮/м³' : t.unit === 'PERCENT' ? '%' : '₮'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-emerald-50 p-3">
              <dt className="text-xs font-medium text-emerald-800">Бүртгэх</dt>
              <dd className="text-2xl font-bold tabular-nums text-emerald-900">
                {preview.summary.willImport}
              </dd>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <dt className="text-xs font-medium text-amber-900">Дарж бичих</dt>
              <dd className="text-2xl font-bold tabular-nums text-amber-900">
                {preview.summary.willReplace}
              </dd>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <dt className="text-xs font-medium text-red-800">Бүртгэлгүй тоот</dt>
              <dd className="text-2xl font-bold tabular-nums text-red-900">
                {preview.summary.unknownFlats}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <dt className="text-xs font-medium text-slate-600">Нийт дүн</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900">
                {formatMnt(preview.summary.totalAmount)}
              </dd>
            </div>
          </dl>

          {preview.summary.willReplace > 0 && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              ⚠️ Тухайн сард аль хэдийн байгаа{' '}
              <span className="font-semibold">{preview.summary.willReplace}</span> нэхэмжлэлийг ДАРЖ
              бичнэ. Төлбөр (хуваарилалт) хөндөгдөхгүй — зөвхөн нэхэмжилсэн дүн шинэчлэгдэнэ.
            </p>
          )}

          {preview.unknownFlats.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">flats хүснэгтэд байхгүй тоот — бүртгэхгүй:</p>
              <p className="mt-1 font-mono text-xs">
                {preview.unknownFlats
                  .map((u) => `${u.flatNumber} («${u.sheet}» мөр ${u.rowIndex})`)
                  .join(', ')}
              </p>
            </div>
          )}

          {preview.skipped.length > 0 && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold">Алгасагдсан мөр:</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {preview.skipped.slice(0, 10).map((s) => (
                  <li key={`${s.sheet}-${s.rowIndex}`}>
                    «{s.sheet}» мөр {s.rowIndex}: {s.reason}
                    {s.raw && ` — «${s.raw}»`}
                  </li>
                ))}
                {preview.skipped.length > 10 && <li>… бас {preview.skipped.length - 10} мөр</li>}
              </ul>
            </div>
          )}

          <div className="mb-5 max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                {isWater ? (
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Тоот</th>
                    <th className="px-3 py-2 text-right font-medium">Халуун</th>
                    <th className="px-3 py-2 text-right font-medium">Хүйтэн</th>
                    <th className="px-3 py-2 text-right font-medium">Нийт м³</th>
                    <th className="px-3 py-2 text-right font-medium">Төлбөр</th>
                    <th className="px-3 py-2 text-left font-medium">Төлөв</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Тоот</th>
                    <th className="px-3 py-2 text-right font-medium">Өмнөх</th>
                    <th className="px-3 py-2 text-right font-medium">Одоо</th>
                    <th className="px-3 py-2 text-right font-medium">Зарцуулалт</th>
                    <th className="px-3 py-2 text-right font-medium">Дүн</th>
                    <th className="px-3 py-2 text-left font-medium">Төлөв</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.rows.map((row) => (
                  <tr key={`${row.sheet}-${row.rowIndex}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-semibold tabular-nums">{row.flatNumber}</td>
                    {isWater ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-500">
                          {row.hotPrev} → {row.hotCurrent}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-500">
                          {row.coldPrev} → {row.coldCurrent}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {row.prevReading ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                          {row.currentReading ?? '—'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-700">
                      {row.usageAmount ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatMnt(row.billAmount)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.isReplacing ? (
                        <span className="text-amber-700">дарж бичнэ</span>
                      ) : (
                        <span className="text-emerald-700">шинэ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => send('commit')}
              disabled={
                busy !== null ||
                preview.summary.willImport === 0 ||
                preview.duplicateFlats.length > 0
              }
              className="rounded-lg bg-emerald-600 px-8 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === 'commit' ? 'Бүртгэж байна…' : `${preview.summary.willImport} нэхэмжлэл бүртгэх`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Болих
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Дүн ────────────────────────────────────────────────────────── */}
      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="font-semibold text-emerald-900">✓ Бүртгэгдлээ</h2>
          <dl className="mt-3 space-y-1 text-sm text-emerald-900">
            <div className="flex justify-between">
              <dt>Бүртгэсэн нэхэмжлэл</dt>
              <dd className="font-bold tabular-nums">{result.imported}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Үүнээс дарж бичсэн</dt>
              <dd className="font-bold tabular-nums">{result.replaced}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Нийт нэхэмжилсэн дүн</dt>
              <dd className="font-bold tabular-nums">{formatMnt(result.totalAmount)}</dd>
            </div>
            {result.unknownFlats > 0 && (
              <div className="flex justify-between">
                <dt>Бүртгэлгүй тоот (орхисон)</dt>
                <dd className="font-bold tabular-nums">{result.unknownFlats}</dd>
              </div>
            )}
          </dl>
          <button
            type="button"
            onClick={() => {
              reset();
              setSheets(null);
              setFileName(null);
            }}
            className="mt-4 rounded-lg border border-emerald-300 bg-white px-5 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            Дараагийн файл
          </button>
        </div>
      )}
    </div>
  );
}
