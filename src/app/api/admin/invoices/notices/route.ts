import { NextResponse } from 'next/server';
import { loadNotices } from '@/lib/notices-load';
import { requireAdmin } from '@/lib/supabase/server';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /api/admin/invoices/notices?month=YYYY-MM — хаалганы мэдэгдлийн өгөгдөл
 *
 * ЯАГААД PDF БИШ JSON БУЦААВ: PDF-ийг сервер дээр үүсгэвэл ~200 айлын
 * файл Vercel-ийн 10 секундын хязгаарт цохих эрсдэлтэй. Сервер зөвхөн
 * тоогоо бодоод, PDF-ийг браузер үүсгэнэ (Excel татахтай ижил зарчим).
 */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const month = new URL(request.url).searchParams.get('month') ?? '';
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: 'Сар буруу байна' }, { status: 400 });
  }

  return NextResponse.json(await loadNotices(month));
}
