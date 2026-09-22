/**
 * Админ эрхтэй и-мэйлүүдийн цагаан жагсаалт.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * Supabase-ийн publishable (anon) key браузерын код дотор харагддаг. Тиймээс
 * хэн ч /auth/v1/signup руу шууд хүсэлт тавьж бүртгүүлэх боломжтой. Хэрэв
 * зөвхөн «нэвтэрсэн эсэх»-ийг шалгавал тэр хүн ШУУД админ болж, нэхэмжлэл
 * оруулах, тариф солих эрх авна.
 *
 * Supabase дээр «шинэ бүртгэл хаах» тохиргоо нь анхдагч хамгаалалт, энэ нь
 * кодын талын ХОЁРДУГААР давхарга. Тохиргоо санамсаргүй нээгдсэн ч систем
 * хамгаалалттай хэвээр байна.
 */

/** ADMIN_EMAILS env-ийг жагсаалт болгон уншина */
function allowedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Жагсаалт ХООСОН бол хэнийг ч оруулахгүй (fail-closed).
 * Ингэснээр env тохируулж мартсан тохиолдолд систем нээлттэй болчихгүй.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = allowedEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

/** Тохиргоо бүрэн эсэх — login хуудсанд сануулга харуулахад хэрэглэнэ */
export function isAllowlistConfigured(): boolean {
  return allowedEmails().length > 0;
}
