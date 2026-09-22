import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import type { AnnouncementKind } from '@/lib/types';

const KINDS: AnnouncementKind[] = ['INFO', 'URGENT', 'MAINTENANCE'];

/**
 * POST /api/admin/announcements — зарлал нэмэх
 *
 * Body: { kind, title, body, isPinned?, expiresAt? }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const payload = (await request.json()) as {
    kind?: string;
    title?: string;
    body?: string;
    isPinned?: boolean;
    expiresAt?: string | null;
  };

  const title = payload.title?.trim();
  const body = payload.body?.trim();
  const kind = (payload.kind ?? 'INFO') as AnnouncementKind;

  if (!title || !body) {
    return NextResponse.json({ error: 'Гарчиг ба агуулга шаардлагатай' }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Төрөл буруу' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('announcements')
    .insert({
      kind,
      title,
      body,
      is_pinned: payload.isPinned === true,
      expires_at: payload.expiresAt || null,
      created_by: admin.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}

/**
 * PATCH /api/admin/announcements — нуух / гаргах / онцлох
 *
 * Body: { id, isActive?, isPinned? }
 * Устгахын оронд нуух нь илүү — андуурч устгасныг сэргээх боломжтой.
 */
export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const { id, isActive, isPinned } = (await request.json()) as {
    id?: string;
    isActive?: boolean;
    isPinned?: boolean;
  };
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const patch: Record<string, boolean> = {};
  if (typeof isActive === 'boolean') patch.is_active = isActive;
  if (typeof isPinned === 'boolean') patch.is_pinned = isPinned;
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Өөрчлөх зүйл байхгүй' }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db.from('announcements').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/announcements?id=<id> — бүрмөсөн устгах */
export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db.from('announcements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
