/**
 * Админы хуудас ачаалагдаж байх үеийн бүрхүүл.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: Supabase сервер хол байгаа тул хүсэлт бүр 1–2
 * секунд авдаг. Энэ хугацаанд дэлгэц огт хөдлөхгүй байсан тул «дарсан
 * уу, үгүй юу», «систем гацсан уу» гэж эргэлздэг байв.
 *
 * Хуурамч мэдээлэл харуулахгүй — зөвхөн БАЙРЛАЛЫГ нь тэмдэглэнэ.
 * Ингэснээр дата ирэхэд агуулга нь үсэрч шилжихгүй.
 */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Ачаалж байна…</span>

      {/* Гарчиг */}
      <Bar className="mb-2 h-7 w-48" />
      <Bar className="mb-6 h-4 w-72" />

      {/* Статистик картууд */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <Bar className="mb-2 h-3 w-20" />
            <Bar className="h-7 w-32" />
          </div>
        ))}
      </div>

      {/* Шүүлтүүрийн карт */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-6">
          {['w-40', 'w-56', 'w-48', 'w-64'].map((w, i) => (
            <div key={i}>
              <Bar className="mb-1.5 h-2.5 w-14" />
              <Bar className={`h-9 ${w}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Хүснэгт */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <Bar className="h-3 w-40" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
            <Bar className="h-4 w-16" />
            <Bar className="h-4 w-24" />
            <Bar className="h-4 flex-1" />
            <Bar className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
