'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';

/**
 * Нэвтрэх форм.
 *
 * useSearchParams() хэрэглэдэг тул Suspense дотор л зурагдана (Next.js-ийн
 * шаардлага) — тиймээс хуудаснаас тусад гаргасан.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';
  // middleware-ээс ирсэн: нэвтэрсэн боловч ADMIN_EMAILS-д байхгүй хаяг
  const denied = params.get('denied') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Эрхгүй хаягаар нэвтэрсэн хүн cookie-тэй хэвээр үлддэг тул login дээр
   * дахин дахин шиднэ. Session-ыг цэвэрлэж өгөх гарц хэрэгтэй.
   */
  async function handleSignOut() {
    setBusy(true);
    await createBrowserSupabase().auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      // Тодорхой шалтгааныг нуух — хэн нэгэн и-мэйл таамаглахад тус болохгүй
      setError('И-мэйл эсвэл нууц үг буруу байна');
      setBusy(false);
      return;
    }

    // router.refresh() — сервер тал шинэ cookie-г харахын тулд
    router.replace(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
          И-мэйл
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Нууц үг
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10"
        />
      </div>

      {denied && !error && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <p className="font-semibold">Энэ хаягт админ эрх байхгүй</p>
          <p className="mt-0.5 text-amber-800">
            Нууц үг зөв боловч хаяг нь зөвшөөрөгдсөн жагсаалтад байхгүй. СӨХ-ийн
            админтай холбогдоно уу.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={busy}
            className="mt-2 text-sm font-semibold underline underline-offset-2 disabled:opacity-50"
          >
            Гарах
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? 'Нэвтэрч байна…' : 'Нэвтрэх'}
      </button>
    </form>
  );
}
