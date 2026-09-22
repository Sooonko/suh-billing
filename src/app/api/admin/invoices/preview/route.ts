import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/server';
import { analyzeInvoiceImport, isImportError } from '@/lib/invoice-import';

/**
 * POST /api/admin/invoices/preview
 *
 * Нэхэмжлэлийн Excel-ийг УНШИЖ ХАРУУЛНА — датабазад юу ч бичихгүй.
 *
 * Body: { category, billingMonth, rows }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const result = await analyzeInvoiceImport(await request.json());
  if (isImportError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    category: result.category,
    billingMonth: result.billingMonth,
    columns: result.columns,
    tariffs: result.tariffs,
    sheetSummary: result.sheetSummary,
    summary: {
      willImport: result.valid.length,
      willReplace: result.valid.filter((r) => r.isReplacing).length,
      unknownFlats: result.unknownFlats.length,
      skipped: result.skipped.length,
      duplicateFlats: result.duplicateFlats.length,
      totalAmount: result.totalAmount,
    },
    rows: result.valid,
    unknownFlats: result.unknownFlats,
    skipped: result.skipped,
    duplicateFlats: result.duplicateFlats,
  });
}
