import { createClient } from '@supabase/supabase-js';

/**
 * Service-role клиент — RLS-ийг ТОЙРЧ өнгөрнө.
 *
 * ⚠️ ЗӨВХӨН сервер талд (API route, Server Component) ашиглана.
 * Энэ key браузер руу гарвал хэн ч бүх датаг уншиж, бичиж чадна.
 *
 * Оршин суугчийн дэлгэц нууц үггүй тул Supabase руу ШУУД хандахгүй —
 * API route-оор дамжиж, зөвхөн ӨӨРИЙН тоотын датаг авна.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL болон SUPABASE_SERVICE_ROLE_KEY тохируулагдаагүй байна');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
