import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/layout/AdminNav';
import { FeedbackProvider } from '@/components/ui/Feedback';
import { requireAdmin } from '@/lib/supabase/server';

/**
 * Админы хамгаалалттай хэсгийн бүрхүүл.
 *
 * middleware.ts аль хэдийн хамгаалсан ч ЭНД ДАХИН шалгана — хамгаалалтыг
 * зөвхөн middleware-т найдуулах нь эрсдэлтэй (matcher андуурах, шинэ route
 * нэмэхэд мартах г.м).
 *
 * /admin/login энэ бүлэгт ОРООГҮЙ тул нэвтрэх дэлгэц админы цэс өмсөхгүй.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect('/admin/login');

  return (
    // FeedbackProvider — баталгаажуулах цонх, мэдэгдлийг бүх админ дэлгэцэд нэг загвараар
    <FeedbackProvider>
      <div className="flex min-h-dvh flex-col bg-slate-100">
        <AdminNav email={admin.email ?? ''} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </FeedbackProvider>
  );
}
