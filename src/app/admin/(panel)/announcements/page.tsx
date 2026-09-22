import { AnnouncementForm } from '@/components/admin/AnnouncementForm';
import { AnnouncementRow, type AdminAnnouncement } from '@/components/admin/AnnouncementRow';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Зарлал удирдах дэлгэц.
 *
 * Оршин суугчийн дэлгэцээс өөр: нуусан болон хугацаа дууссан зарлалыг ч
 * харуулна — админ юу байгааг бүтнээр харах ёстой.
 */
export default async function AdminAnnouncementsPage() {
  const db = createAdminClient();
  const { data, error } = await db
    .from('announcements')
    .select('id, kind, title, body, is_pinned, is_active, published_at, expires_at')
    .order('published_at', { ascending: false })
    .limit(100);

  const items = (data ?? []) as AdminAnnouncement[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Зарлал</h1>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Зарлалын хүснэгт уншигдсангүй</p>
          <p className="mt-1">{error.message}</p>
          <p className="mt-2">
            Supabase → SQL Editor дээр <code className="font-mono">supabase/schema.sql</code>-ыг
            дахин RUN дарсан эсэхээ шалгана уу.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[26rem_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-20">
          <AnnouncementForm />
        </div>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold text-slate-900">Бүртгэлтэй зарлал</h2>
            <span className="text-xs text-slate-400">{items.length}</span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
              Зарлал хараахан байхгүй. Зүүн талын формоор нэмнэ.
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <AnnouncementRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
