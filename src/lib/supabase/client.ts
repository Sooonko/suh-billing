import { createBrowserClient } from '@supabase/ssr';

/**
 * Браузер талын клиент — ЗӨВХӨН админы нэвтрэлтэд.
 *
 * Publishable (anon) key хэрэглэнэ тул RLS хүчинтэй. Нэвтэрсний дараа
 * session cookie-д хадгалагдаж, middleware болон сервер тал түүнийг уншина.
 *
 * ⚠️ Дата уншихад ҮҮНИЙГ хэрэглэхгүй — бүх дата API route-оор дамжина.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
