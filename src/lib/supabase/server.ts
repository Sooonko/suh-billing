import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isAdminEmail } from '@/lib/admin-allowlist';

/** Cookie-д тулгуурласан клиент — админы session-ыг уншина (RLS хүчинтэй) */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component дотроос дуудагдвал бичих боломжгүй — middleware сэргээнэ
          }
        },
      },
    },
  );
}

/**
 * Админ эсэхийг шалгана. Нэвтрээгүй эсвэл эрхгүй бол null буцаана.
 * Бүх /api/admin/* route энэ функцээр эхэлнэ.
 *
 * ХОЁР нөхцөл: (1) токен Supabase сервер дээр баталгаажсан, (2) и-мэйл нь
 * ADMIN_EMAILS жагсаалтад байгаа. Зөвхөн (1)-ийг шалгавал шинээр бүртгүүлсэн
 * хэн ч админ болно — [isAdminEmail] дээрх тайлбарыг үзнэ үү.
 */
export async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  if (!isAdminEmail(data.user.email)) return null;
  return data.user;
}
