import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Announcement } from '@/lib/types';

/**
 * Оршин суугчид харагдах зарлалууд — НЭГ эх сурвалж.
 *
 * Нүүр хуудас, цэсний «шинэ» тэмдэг, тоотын дэлгэцийн сануулга, зарлалын
 * тусдаа хуудас бүгд эндээс авна. Тиймээс аль нэг газар «шинэ 2» гэж
 * байхад нөгөө газар 3 гарах зөрүү үүсэхгүй.
 *
 * 5 минут кэшлэнэ — Supabase-ийн үнэгүй давхаргын ачааллыг бууруулна.
 * Админ зарлал нэмэх, засах, устгахад `revalidateTag('announcements')`
 * дуудагдаж ШУУД шинэчлэгдэнэ.
 */

export const ANNOUNCEMENTS_TAG = 'announcements';

const SELECT = 'id, kind, title, body, is_pinned, published_at, expires_at';

type Row = Announcement & { expires_at: string | null };

/** Хугацаа нь кэшийн хооронд дууссан зарлалыг ч хасна */
function stillVisible(row: Row, now: number): boolean {
  return row.expires_at === null || new Date(row.expires_at).getTime() > now;
}

function strip({ expires_at: _expires, ...rest }: Row): Announcement {
  return rest;
}

const loadActive = unstable_cache(
  async (): Promise<Row[]> => {
    try {
      const db = createAdminClient();
      const { data, error } = await db
        .from('announcements')
        .select(SELECT)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        // Онцлох нь үргэлж дээр, дараа нь шинэ нь дээр
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(20);

      // Хүснэгт хараахан үүсээгүй бол дэлгэц унахгүй — хоосон жагсаалт
      if (error) return [];
      return (data ?? []) as Row[];
    } catch {
      return [];
    }
  },
  // Хэлбэр өөрчлөгдвөл хувилбарыг ахиулна — кэшэнд хуучин хэлбэр үлдэхгүй
  ['resident-announcements', 'v1'],
  { tags: [ANNOUNCEMENTS_TAG], revalidate: 300 },
);

/** Идэвхтэй зарлалууд — онцлох нь эхэнд, дараа нь шинэ нь */
export async function loadAnnouncements(): Promise<Announcement[]> {
  const now = Date.now();
  return (await loadActive()).filter((row) => stillVisible(row, now)).map(strip);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadOneCached = unstable_cache(
  async (id: string): Promise<Row | null> => {
    try {
      const db = createAdminClient();
      const { data, error } = await db
        .from('announcements')
        .select(SELECT)
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) return null;
      return (data as Row | null) ?? null;
    } catch {
      return null;
    }
  },
  ['resident-announcement', 'v1'],
  { tags: [ANNOUNCEMENTS_TAG], revalidate: 300 },
);

/**
 * Нэг зарлал — `/medee/[id]` хуудсанд.
 * Нуусан, хугацаа дууссан, байхгүй бол null (хуудас «олдсонгүй» гарна).
 */
export async function loadAnnouncement(id: string): Promise<Announcement | null> {
  // Буруу хэлбэрийн id-г датабаз руу явуулахгүй — Postgres uuid алдаа шиднэ
  if (!UUID_RE.test(id)) return null;
  const row = await loadOneCached(id.toLowerCase());
  return row && stillVisible(row, Date.now()) ? strip(row) : null;
}
