import {midnight, MS_PER_DAY} from './money';

export type Cadence = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export function cycleDays(c: Cadence): 7 | 14 | 15 | 30 {
  switch (c) {
    case 'weekly':
      return 7;
    case 'semimonthly':
      return 15;
    case 'monthly':
      return 30;
    default:
      return 14;
  }
}

/** Whole days from `today` (midnight) to an ISO date's midnight. */
export function daysUntil(dateIso: string, today: Date): number {
  return Math.round((Date.parse(dateIso + 'T00:00:00') - midnight(today)) / MS_PER_DAY);
}

/** Average days per month used by the design's sustainability math. */
export const DAYS_PER_MONTH = 30.44;
