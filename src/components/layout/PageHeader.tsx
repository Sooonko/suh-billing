/**
 * Хуудасны толгой — гарчиг ба дэд тайлбар.
 * Бүх дэлгэц ижил өндөр, ижил зайтай байхын тулд нэг компонентоор удирдана.
 * Веб дээр фонт томсоно.
 */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5 md:mb-7">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500 md:text-base">{subtitle}</p>}
    </header>
  );
}
