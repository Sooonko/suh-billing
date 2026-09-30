import { PageHeader } from '@/components/layout/PageHeader';
import { SOH } from '@/lib/soh-config';

/**
 * Холбоо барих дэлгэц.
 *
 * Агуулга нь src/lib/soh-config.ts дотор — датабаз хэрэггүй, СӨХ-ийн утас
 * солигдоход нэг файл засаад л боллоо.
 */
export default function ContactPage() {
  const { phone, hours, address, email, messengerGroup } = SOH.contact;
  /** tel: холбоос — зураас, зайг хасна */
  const telHref = `tel:${phone.replace(/[^\d+]/g, '')}`;

  return (
    <div>
      <PageHeader title="Холбоо барих" subtitle={SOH.name} />

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-6">

      {/*
        Зүүн багана: шууд холбогдох сувгууд.
        Утас ба Messenger-ийг ХАМТ байрлуулав — хоёулаа «одоо холбогдох»
        үйлдэл тул нэг дор байх нь ойлгомжтой.
      */}
      <div className="mb-4 space-y-3 md:mb-0">

      {/* Утас — гар утаснаас дархад шууд залгана */}
      <a
        href={telHref}
        className="flex items-center gap-4 rounded-2xl bg-slate-900 p-5 text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] md:p-6"
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

      {/*
        Messenger групп — зөвхөн холбоос тохируулсан үед.
        Шинэ таб руу нээнэ: оршин суугч аппаас гарч яваад буцаж чадахгүй
        болохоос сэргийлнэ. rel нь нээгдсэн хуудсанд манай таб руу хандах
        эрх өгөхгүй.
      */}
      {messengerGroup && (
        <a
          href={messengerGroup}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] md:p-6"
        >
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0084FF]/10 text-[#0084FF]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2Zm1 12.1-2.5-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.4 5.7Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Messenger групп</p>
            <p className="text-base font-bold text-slate-900">Оршин суугчдын чат</p>
            <p className="mt-0.5 text-xs text-slate-500">Зарлал, хамтын асуудал</p>
          </div>
          <span aria-hidden className="text-slate-400">→</span>
        </a>
      )}

      </div>

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
