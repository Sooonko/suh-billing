/** 44239 → "44,239₮" */
export function formatMnt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 0 }).format(Math.abs(value))}₮`;
}

/** Тэмдэг хамт: -20000 → "-20,000₮" */
export function formatSignedMnt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value < 0 ? '-' : ''}${formatMnt(value)}`;
}

/** "2026-08" → "2026 оны 8 сар" */
export function formatBillingMonth(month: string | null | undefined): string {
  if (!month) return '—';
  const [year, m] = month.split('-');
  return `${year} оны ${Number(m)} сар`;
}

/** Тоолуурын заалт: 1234.5 → "1,234.5" */
export function formatReading(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 2 }).format(value);
}

/** "2026-09" → "9 сар" — хүснэгтийн нарийн баганад багтах богино хэлбэр */
export function shortMonth(month: string | null | undefined): string {
  if (!month) return '—';
  const [, m] = month.split('-');
  return `${Number(m)} сар`;
}

/** "2026-09" → "2026-08". 1 сараас өмнөх нь өмнөх оны 12 сар. */
export function previousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`;
}
