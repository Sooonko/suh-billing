import { Suspense } from 'react';
import { LoginForm } from '@/components/admin/LoginForm';

/**
 * Админы нэвтрэх дэлгэц.
 *
 * Хэрэглэгчийг Supabase Dashboard → Authentication → Users → Add user гэж
 * ГАРААР үүсгэнэ. Бүртгүүлэх дэлгэц ЗОРИУД байхгүй — СӨХ-ийн ажилтнаас
 * бусад хүн хаяг үүсгэх боломжгүй байх ёстой.
 *
 * Форм нь useSearchParams() хэрэглэдэг тул Suspense дотор орно.
 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white"
          >
            СӨХ
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Админ нэвтрэх</h1>
          <p className="mt-1 text-sm text-slate-500">Зөвхөн СӨХ-ийн ажилтан</p>
        </div>

        <Suspense
          fallback={
            <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
