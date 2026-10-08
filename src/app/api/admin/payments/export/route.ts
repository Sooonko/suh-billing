import { NextResponse } from 'next/server';
import {
  loadAllPaymentRows,
  parsePaymentFilters,
  PAYMENT_EXPORT_HEADERS,
  STATUS_LABEL,
} from '@/lib/admin/payments-query';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { CATEGORY_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/payments/export?month=&category=&status=&q=
 *
 * «Баримт» жагсаалтын Excel — дэлгэцийн шүүлттэй ЯГ ижил мөрүүд, гэхдээ
 * хуудаслалтгүй (бүгд). Файлыг хөтөч өөрөө бичнэ; энд зөвхөн мөрүүд.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const filters = parsePaymentFilters({
    category: params.get('category'),
    status: params.get('status'),
    month: params.get('month'),
    q: params.get('q'),
  });

  try {
    const rows = await loadAllPaymentRows(createAdminClient(), filters);
    return NextResponse.json({
      headers: PAYMENT_EXPORT_HEADERS,
      rows: rows.map((r) => [
        r.txn_date.slice(0, 10),
        r.amount,
        r.description,
        r.allocations.map((a) => a.flat).join(', ') || '—',
        CATEGORY_LABEL[r.source_category] ?? r.source_category,
        STATUS_LABEL[r.status] ?? r.status,
      ]),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Excel-ийн мөр татахад алдаа гарлаа' },
      { status: 500 },
    );
  }
}
