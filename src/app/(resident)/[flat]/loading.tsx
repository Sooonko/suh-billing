/**
 * Оршин суугчийн төлбөрийн дэлгэц ачаалагдаж байх үе.
 *
 * Гар утаснаас нэвтэрдэг хүн ихтэй тул хоосон цагаан дэлгэц удаан
 * харагдвал «ажиллахгүй байна» гэж бодоод хаадаг. Байрлалыг нь
 * тэмдэглэснээр ядаж юу ирэхийг нь урьдчилж мэдэгдэнэ.
 */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default function ResidentFlatLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Төлбөрийн мэдээлэл ачаалж байна…</span>

      <Bar className="mb-1 h-3 w-12" />
      <Bar className="mb-6 h-9 w-24" />

      {/* Хураангуй карт */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 md:mb-7 md:flex">
        <div className="md:flex-1">
          <Bar className="mb-2 h-4 w-32" />
          <Bar className="h-10 w-52" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 md:mt-0 md:w-80">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Bar className="mb-1.5 h-2.5 w-full" />
              <Bar className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Ангиллын 3 карт */}
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <Bar className="mb-2 h-4 w-28" />
            <Bar className="mb-5 h-3 w-24" />
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className="mb-2.5 flex justify-between gap-4">
                <Bar className="h-3 w-28" />
                <Bar className="h-3 w-16" />
              </div>
            ))}
            <Bar className="mt-5 h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
