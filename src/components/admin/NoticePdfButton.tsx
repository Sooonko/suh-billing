'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Feedback';
import { callApi } from '@/lib/api-client';
import type { NoticesPayload } from '@/lib/notices';

/**
 * Төлбөрийн үлдэгдэлтэй айлуудын хаалганы мэдэгдлийг PDF болгож татна.
 *
 * ЯАГААД БРАУЗЕР ТАЛД: ~200 айлын PDF-ийг сервер дээр үүсгэвэл Vercel-ийн
 * 10 секундын хязгаарт цохих эрсдэлтэй. Сервер зөвхөн тоогоо JSON-оор
 * буцаана (`/api/admin/invoices/notices`).
 *
 * Хурд: өгөгдлийн хүсэлт ба react-pdf + загварын татаж авалтыг ЗЭРЭГ
 * эхлүүлнэ — дараалуулбал хоёр сүлжээний хугацаа нэмэгдэнэ.
 */
export function NoticePdfButton({ month }: { month: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const [result, { pdf }, { NoticeDocument }] = await Promise.all([
        callApi<NoticesPayload>(`/api/admin/invoices/notices?month=${month}`),
        import('@react-pdf/renderer'),
        import('./notice-pdf/NoticeDocument'),
      ]);
      if (!result.ok) {
        toast(result.error, 'error');
        return;
      }
      if (result.data.notices.length === 0) {
        toast('Төлбөрийн үлдэгдэлтэй айл алга.', 'info');
        return;
      }

      const blob = await pdf(<NoticeDocument data={result.data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Мэдэгдэл ${month} (${result.data.notices.length} айл).pdf`;
      link.click();
      // Татаж эхэлсний дараа санах ойг чөлөөлнө
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      toast('PDF үүсгэж чадсангүй. Дахин оролдоно уу.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy || !month}
      title="Төлбөрийн үлдэгдэлтэй айлуудын хаалганд наах мэдэгдэл (A4-т 4 айл)"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z" />
      </svg>
      {busy ? 'PDF бэлдэж байна…' : 'Хаалганы мэдэгдэл (PDF)'}
    </button>
  );
}
