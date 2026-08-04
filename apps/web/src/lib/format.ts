import type {Cadence} from '@runway/shared';

/**
 * How each cadence is named to the user. Keyed by `Cadence` so a cadence the
 * domain knows about cannot be missing from a picker: adding one to the union
 * fails to compile here rather than quietly leaving the earners on it to pick
 * the nearest wrong option (#67).
 */
export const CADENCE_LABELS: {[K in Cadence]: string} = {
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  semimonthly: 'Twice a month',
  monthly: 'Monthly',
};

/** The cadences in pickable order — shortest cycle first. */
export const CADENCE_OPTIONS = Object.entries(CADENCE_LABELS) as [Cadence, string][];

/** Money formatter — U+2212 minus sign per the design (catalog §3.9). */
export function formatMoney(n: number, showCents = true): string {
  const neg = n < 0;
  const v = Math.abs(n);
  const s = showCents
    ? v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
    : Math.round(v).toLocaleString('en-US');
  return (neg ? '−$' : '$') + s;
}

/** Hero/sidebar day figure — ASCII hyphen, no cents, no separators. */
export function formatDayAmount(n: number): string {
  return (n < 0 ? '-$' : '$') + Math.abs(n);
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
