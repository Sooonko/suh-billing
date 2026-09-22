import type { PaymentStatus } from '@/lib/types';

/** Төлөв бүрийн монгол нэр ба өнгө — нэг эх сурвалжаас удирдана */
const STYLES: Record<PaymentStatus, { label: string; className: string }> = {
  PAID: { label: 'ТӨЛСӨН', className: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20' },
  UNPAID: { label: 'ТӨЛӨӨГҮЙ', className: 'bg-red-100 text-red-800 ring-red-600/20' },
  PARTIAL: { label: 'ДУТУУ ТӨЛСӨН', className: 'bg-amber-100 text-amber-900 ring-amber-600/20' },
  OVERPAID: { label: 'ИЛҮҮ ТӨЛӨЛТТЭЙ', className: 'bg-blue-100 text-blue-800 ring-blue-600/20' },
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}
