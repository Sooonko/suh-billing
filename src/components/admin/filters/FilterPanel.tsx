/**
 * Шүүлтүүрийн карт — админы бүх жагсаалтын хуудсанд ижил.
 *
 * Өмнө нь шүүлтүүрүүд хуудсанд «нүцгэн» байсан тул гарчиг, статистик,
 * шүүлт, хүснэгт дөрөв нэг л түвшинд харагдаж, хаанаас хаа хүртэл нь
 * шүүлт болохыг нүд салгаж чаддаггүй байв. Картан хүрээ нь тэр хилийг
 * зурж өгнө.
 *
 * Баруун талд нэг үйлдлийн зай (`action`) — Excel татах товч тэнд сууна.
 */
export function FilterPanel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        {children}
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </div>
  );
}

/** Шүүлтүүрийн нэг талбар — дээр нь жижиг том үсгээр гарчиг */
export function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
