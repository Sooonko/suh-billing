'use client';

import { useState } from 'react';

/**
 * Шүүсэн жагсаалтыг Excel болгож татна.
 *
 * ЯАГААД БРАУЗЕР ТАЛД: файл үүсгэх ажлыг сервер рүү явуулбал Vercel-ийн
 * 10 секундын хязгаарт цохих эрсдэлтэй, бас датаг дахин татах хэрэгтэй
 * болно. Мөрүүд нь дэлгэцэнд аль хэдийн байгаа тул эндээс шууд бичнэ.
 *
 * `xlsx` нь ~400KB — динамикаар татна. Товч дарах хүртэл хуудасны
 * ачаалалд нэмэгдэхгүй.
 *
 * ⚠️ Функцийг props-оор дамжуулж БОЛОХГҮЙ (Server → Client Component-д
 * функц serialize хийгддэггүй). Тиймээс хуудас нь толгой ба мөрүүдийг
 * ЭНГИЙН массив болгож бэлдээд өгнө.
 */
export function ExcelExportButton({
  filename,
  sheetName = 'Жагсаалт',
  headers,
  rows,
}: {
  /** Өргөтгөлгүй: «Ус дулаан 2026-09» */
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | null)[][];
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Багана бүрийн өргөнийг агуулгаар нь тааруулна — үгүй бол бүх
      // багана ижил нарийн болж, дүн «####» болж харагдана
      sheet['!cols'] = headers.map((header, i) => {
        const longest = rows.reduce(
          (max, row) => Math.max(max, String(row[i] ?? '').length),
          header.length,
        );
        return { wch: Math.min(Math.max(longest + 2, 8), 40) };
      });

      const book = XLSX.utils.book_new();
      // Excel-ийн хуудасны нэр 31 тэмдэгтээс хэтэрвэл файл эвдэрдэг
      XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
      XLSX.writeFile(book, `${filename}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy || rows.length === 0}
      title={rows.length === 0 ? 'Татах мөр байхгүй' : `${rows.length} мөр татна`}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
        <path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16" />
      </svg>
      {busy ? 'Бэлдэж байна…' : 'Excel татах'}
    </button>
  );
}
