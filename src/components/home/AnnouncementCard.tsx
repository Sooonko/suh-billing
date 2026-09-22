import type { Announcement, AnnouncementKind } from '@/lib/types';

/** Төрөл бүрийн өнгө ба шошго — нэг эх сурвалжаас удирдана */
const KIND: Record<AnnouncementKind, { label: string; badge: string; bar: string }> = {
  URGENT: {
    label: 'Яаралтай',
    badge: 'bg-red-100 text-red-800 ring-red-600/20',
    bar: 'bg-red-500',
  },
  MAINTENANCE: {
    label: 'Засвар, хуваарь',
    badge: 'bg-amber-100 text-amber-900 ring-amber-600/20',
    bar: 'bg-amber-500',
  },
  INFO: {
    label: 'Мэдээлэл',
    badge: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    bar: 'bg-slate-300',
  },
};

/** "2026-09-18T..." → "9 сарын 18" */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1} сарын ${d.getDate()}`;
}

export function AnnouncementCard({ item }: { item: Announcement }) {
  const kind = KIND[item.kind] ?? KIND.INFO;

  return (
    <article className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Зүүн захын өнгөт зураас — төрлийг нэг харцаар таниулна */}
      <div aria-hidden className={`w-1 shrink-0 ${kind.bar}`} />

      <div className="min-w-0 flex-1 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ring-1 ring-inset ${kind.badge}`}
          >
            {kind.label}
          </span>
          {item.is_pinned && (
            <span className="text-[11px] font-semibold text-slate-400">📌 Онцлох</span>
          )}
          <span className="ml-auto text-xs text-slate-400">{shortDate(item.published_at)}</span>
        </div>

        <h3 className="font-semibold leading-snug text-slate-900">{item.title}</h3>
        {/* whitespace-pre-line — админ мөр шинээр бичсэнийг хадгална */}
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">{item.body}</p>
      </div>
    </article>
  );
}
