'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/ui/Feedback';
import { callApi } from '@/lib/api-client';
import { formatMnt } from '@/lib/format';
import { readFirstGrid } from '@/lib/read-sheet';
import { RECIPIENT_LABEL, RECIPIENTS, serializeGrid, type NewTransfer } from '@/lib/transfers';

/**
 * Гараар хөтөлсөн «Шилжүүлсэн баримт» Excel-ийг оруулах.
 *
 *   файл → dryRun (юу орохыг харуулна) → баталгаажуулна → бүртгэнэ
 *
 * Хуулгаас аль хэдийн орсон шилжүүлэг (хүлээн авагч + огноо + дүн ижил)
 * давхардахгүй.
 */

type PreviewTransfer = NewTransfer & { isDuplicate: boolean };

interface Preview {
  transfers: PreviewTransfer[];
  skipped: { rowIndex: number; text: string; reason: string }[];
}

export function TransferLedgerImport() {
  const router = useRouter();
  const confirm = useConfirm();
  const [grid, setGrid] = useState<unknown[][] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(null);
    setMessage(null);
    setError(null);
    setBusy(true);

    try {
      const serialized = serializeGrid(await readFirstGrid(file));
      setGrid(serialized);
      const result = await callApi<Preview>('/api/admin/transfers/import', {
        method: 'POST',
        json: { grid: serialized, dryRun: true },
      });
      if (result.ok) setPreview(result.data);
      else setError(result.error);
    } catch {
      setError('Excel файл уншигдсангүй.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  const fresh = preview?.transfers.filter((t) => !t.isDuplicate) ?? [];
  const duplicates = (preview?.transfers.length ?? 0) - fresh.length;

  async function commit() {
    if (!grid || !fresh.length) return;
    const ok = await confirm({
      title: 'Шилжүүлэг бүртгэх үү?',
      details: [
        ['Шинэ шилжүүлэг', String(fresh.length)],
        ['Нийт дүн', formatMnt(fresh.reduce((sum, t) => sum + t.amount, 0))],
      ],
      confirmLabel: 'Бүртгэх',
      tone: 'success',
    });
    if (!ok) return;

    setBusy(true);
    const result = await callApi<{ inserted: number; duplicates: number }>('/api/admin/transfers/import', {
      method: 'POST',
      json: { grid },
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(null);
    setGrid(null);
    setMessage(
      `✓ ${result.data.inserted} шилжүүлэг бүртгэгдлээ` +
        (result.data.duplicates ? ` · ${result.data.duplicates} давхардсан тул алгассан` : ''),
    );
    router.refresh();
  }

  return (
    <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-slate-700">
        Шилжүүлгийн Excel оруулах (гараар хөтөлсөн түүх)
      </summary>

      <div className="space-y-4 border-t border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-500">
          «№ · Огноо · Хаана · Мөнгөн дүн» блоктой файл. Блокийн дээр гарчиг бичсэн бол (жишээ
          «Орхоны шугуй ХХК-ийн өрөнд») тэр нь тэмдэглэл болно. Хуулгаас аль хэдийн орсныг давхардуулахгүй.
        </p>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          disabled={busy}
          className="block w-full cursor-pointer rounded-lg border border-slate-300 text-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        />

        {busy && <p className="text-sm text-slate-500">Уншиж байна…</p>}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}

        {preview && (
          <>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left font-medium">Хүлээн авагч</th>
                  <th className="py-2 text-right font-medium">Шинэ</th>
                  <th className="py-2 text-right font-medium">Дүн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {RECIPIENTS.flatMap(({ key }) => {
                  const rows = fresh.filter((t) => t.recipient === key);
                  // Тэмдэглэлтэй (Орхоны шугуй г.м) хэсгийг тусад нь
                  const groups = [...new Set(rows.map((t) => t.note))];
                  return groups.map((note) => {
                    const group = rows.filter((t) => t.note === note);
                    return (
                      <tr key={`${key}-${note}`}>
                        <td className="py-2">
                          {RECIPIENT_LABEL[key]}
                          {note && <span className="block text-xs text-indigo-700">{note}</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums">{group.length}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {formatMnt(group.reduce((sum, t) => sum + t.amount, 0))}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>

            {duplicates > 0 && (
              <p className="text-xs text-slate-500">{duplicates} шилжүүлэг аль хэдийн бүртгэгдсэн — алгасна.</p>
            )}
            {preview.skipped.length > 0 && (
              <details className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <summary className="cursor-pointer font-semibold">
                  Бүртгэхгүй {preview.skipped.length} мөр
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {preview.skipped.map((s) => (
                    <li key={`${s.rowIndex}-${s.text}`}>
                      мөр {s.rowIndex}: {s.text} — {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <button
              type="button"
              onClick={commit}
              disabled={busy || fresh.length === 0}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {fresh.length ? `${fresh.length} шилжүүлэг бүртгэх` : 'Бүртгэх шинэ шилжүүлэг алга'}
            </button>
          </>
        )}
      </div>
    </details>
  );
}
