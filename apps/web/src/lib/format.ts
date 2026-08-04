/** Stand-in for a money figure we cannot render — U+2014 em dash. */
const NO_AMOUNT = '$—';

/** Money formatter — U+2212 minus sign per the design (catalog §3.9). */
export function formatMoney(n: number, showCents = true): string {
  if (!Number.isFinite(n)) return NO_AMOUNT;
  const neg = n < 0;
  const v = Math.abs(n);
  const s = showCents
    ? v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
    : Math.round(v).toLocaleString('en-US');
  return (neg ? '−$' : '$') + s;
}

/** Hero/sidebar day figure — ASCII hyphen, no cents, grouped thousands. */
export function formatDayAmount(n: number): string {
  if (!Number.isFinite(n)) return NO_AMOUNT;
  return (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');
}

/** Short date from a day offset relative to `today`, e.g. "Jul 30". */
export function formatShortDate(off: number, today: Date): string {
  const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off);
  return dt.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}

export function ordinalSuffix(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
