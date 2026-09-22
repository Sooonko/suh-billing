import { PageHeader } from '@/components/layout/PageHeader';
import { SOH } from '@/lib/soh-config';

/**
 * Холбоо барих дэлгэц.
 *
 * Агуулга нь src/lib/soh-config.ts дотор — датабаз хэрэггүй, СӨХ-ийн утас
 * солигдоход нэг файл засаад л боллоо.
 */
export default function ContactPage() {
  const { phone, hours, address, email } = SOH.contact;
  /** tel: холбоос — зураас, зайг хасна */
  const telHref = `tel:${phone.replace(/[^\d+]/g, '')}`;

  return (
    <div>
      <PageHeader title="Холбоо барих" subtitle={SOH.name} />

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">

      {/* Утас — гар утаснаас дархад шууд залгана */}
      <a
        href={telHref}
        className="mb-4 flex items-center gap-4 rounded-2xl bg-slate-900 p-5 text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] md:mb-0 md:p-6"
      >
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M3 5a2 2 0 0 1 2-2h2.2a1 1 0 0 1 1 .8l.8 3.4a1 1 0 0 1-.3 1L7 9.8a12 12 0 0 0 5.2 5.2l1.6-1.7a1 1 0 0 1 1-.3l3.4.8a1 1 0 0 1 .8 1V17a2 2 0 0 1-2 2h-1A14 14 0 0 1 3 6V5Z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-300">Утас</p>
          <p className="text-xl font-bold tabular-nums tracking-wide">{phone}</p>
        </div>
        <span aria-hidden className="text-slate-400">→</span>
      </a>

      <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-5 py-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Ажиллах цаг</dt>
          <dd className="mt-1 space-y-0.5 text-sm text-slate-900">
            {hours.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </dd>
        </div>

        <div className="px-5 py-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Хаяг</dt>
          <dd className="mt-1 text-sm text-slate-900">{address}</dd>
        </div>

        {email && (
          <div className="px-5 py-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">И-мэйл</dt>
            <dd className="mt-1 text-sm">
              <a href={`mailto:${email}`} className="text-slate-900 underline decoration-slate-300">
                {email}
              </a>
            </dd>
          </div>
        )}
      </dl>
      </div>

      <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
        Төлбөрийн зөрүү, нэхэмжлэлийн асуудлыг
        <br />
        СӨХ-ийн ажилтантай биечлэн шийдвэрлэнэ.
      </p>
    </div>
  );
}
