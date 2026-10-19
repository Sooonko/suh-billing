import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { parseTransferLedger } from '@/lib/transfers';
import { findDuplicateTransfers, insertTransfers } from '@/lib/transfers-db';

/**
 * POST /api/admin/transfers/import
 *
 * Гараар хөтөлсөн «Шилжүүлсэн баримт» Excel-ийг оруулна.
 *
 * Body: { grid: unknown[][], dryRun?: boolean }
 *   grid — браузер дээр SheetJS-ээр уншсан сараалж, огноо нь 'YYYY-MM-DD'
 *          мөр болгосон (`serializeGrid`). Сервер ДАХИН задлана —
 *          клиентийн дүгнэлтэд найдахгүй.
 *   dryRun — true бол юу ч бичихгүй, юу орохыг л харуулна.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const { grid, dryRun } = (await request.json()) as { grid?: unknown[][]; dryRun?: boolean };
  if (!Array.isArray(grid)) return NextResponse.json({ error: 'grid шаардлагатай' }, { status: 400 });

  const { transfers, skipped, blocks } = parseTransferLedger(grid);
  if (!blocks) {
    return NextResponse.json(
      { error: '«Огноо · Хаана · Мөнгөн дүн» гэсэн толгой олдсонгүй. Файлын бүтцийг шалгана уу.' },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  if (dryRun) {
    const isDuplicate = await findDuplicateTransfers(db, transfers);
    return NextResponse.json({
      transfers: transfers.map((t, i) => ({ ...t, isDuplicate: isDuplicate[i] })),
      skipped,
    });
  }

  const result = await insertTransfers(db, transfers, {
    source: 'LEDGER',
    batchId: crypto.randomUUID(),
    createdBy: admin.id,
  });
  if (result.error) {
    return NextResponse.json({ error: `Бүртгэхэд алдаа: ${result.error}` }, { status: 500 });
  }
  return NextResponse.json({ inserted: result.inserted, duplicates: result.duplicates });
}
