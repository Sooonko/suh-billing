import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/admin-allowlist';

/**
 * Админ хэсгийн хамгаалалт + session сэргээлт.
 *
 * Хоёр ажил хийнэ:
 *  1. Supabase-ийн access token хугацаа дуусахад cookie-г ЧИМЭЭГҮЙ шинэчилнэ.
 *     Үүнгүйгээр админ 1 цагийн дараа аяндаа гарчихдаг.
 *  2. Нэвтрээгүй хүнийг /admin/* -аас login руу шиднэ.
 *
 * NB: Оршин суугчийн дэлгэц Supabase Auth хэрэглэдэггүй тул matcher-ыг
 * зөвхөн /admin руу хязгаарласан — бусад хуудсанд илүү ажил гүйцэтгэхгүй.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() нь токеныг Supabase сервер дээр баталгаажуулна.
  // getSession() хэрэглэвэл cookie-г хуурамчаар бичих боломж гарна.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/admin/login';

  // Нэвтэрсэн Ч ГЭСЭН и-мэйл цагаан жагсаалтад байхгүй бол админ биш.
  // Ингэхгүй бол Supabase дээр шинээр бүртгүүлсэн хэн ч админ болно.
  const isAdmin = !!user && isAdminEmail(user.email);

  if (!isAdmin && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    // Нэвтэрсэн боловч эрхгүй бол login хуудсанд ТОДОРХОЙ сануулга харуулна.
    // Үүнгүйгээр «нууц үг буруу байна» гэж андуурч тэр хүн дахин дахин оролдоно.
    url.search = user
      ? '?denied=1'
      : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Нэвтэрсэн хүн login хуудас руу оръё гэвэл хяналтын самбар руу
  if (isAdmin && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = { matcher: ['/admin/:path*'] };
