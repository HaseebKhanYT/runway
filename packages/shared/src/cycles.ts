export const MS_PER_DAY = 86400000;

/** Midnight of the given date in local time. */
export function midnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

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

/** A date offset from `today` by whole days, as a local-time `YYYY-MM-DD`. */
export function toIsoDate(today: Date, offsetDays = 0): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * True when `iso` is `YYYY-MM-DD` *and* names a day that exists. The shape
 * alone is not enough: `Date.parse('2026-13-45T00:00:00')` is `NaN`, so a
 * string that only looks like a date reaches the math as a silent absence
 * rather than as a rejected input.
 */
export function isCalendarDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The furthest away a *next* payday can honestly be, in days.
 *
 * One cycle, rounded up to the longest calendar gap that cycle can span, so a
 * monthly earner setting up on the 31st is not refused for naming the 31st of
 * next month. `cycleDays` cannot serve here because it answers a different
 * question — how long a cycle is on average — and using it as a bound would
 * reject real pay dates.
 */
export function maxDaysToPayday(c: Cadence): number {
  switch (c) {
    case 'monthly':
      return 31;
    case 'semimonthly':
      return 16;
    default:
      return cycleDays(c);
  }
}

/**
 * Why a date the user is *asserting* as their next payday cannot be one, or
 * `null` when it can. Both the onboarding form and the API schema call this,
 * so the browser and the server refuse the same dates for the same stated
 * reason instead of one silently accepting what the other rejects.
 *
 * This is deliberately stricter than what `daysToNextPayday` tolerates in
 * stored state. A date already on file goes stale on its own as time passes;
 * a date being typed right now is a claim about the future, and a claim that
 * the paycheck already landed — or lands after the one following it — is
 * wrong at the moment it is made.
 */
export function nextPayProblem(nextPay: string, cadence: Cadence, today: Date): string | null {
  if (!isCalendarDate(nextPay)) return 'That is not a real date.';
  const max = maxDaysToPayday(cadence);
  if (nextPay < toIsoDate(today)) {
    return 'That day has already passed — pick the day your next paycheck lands.';
  }
  if (nextPay > toIsoDate(today, max)) {
    return `That is more than one pay cycle away — a ${cadence} paycheck lands within ${max} days.`;
  }
  return null;
}

/**
 * Whole days from `today` to the next payday, given the date on file.
 *
 * A stored payday only moves when the user confirms a paycheck landed, so it
 * slides into the past whenever they simply do not open the app. This function
 * reads that as the cycle having turned over — the paycheck came and the next
 * one is a cycle later — and rolls the date forward by whole cycles. Clamping
 * to one day instead, as this used to, divides the whole balance by a single
 * day and reports it as spendable today.
 *
 * A payday further out than one cycle is returned as-is rather than clamped
 * down to `cycleDays`: if the money really is that far away it has to stretch
 * that far, and honouring the date can only ever lower the daily number, never
 * inflate it.
 */
export function daysToNextPayday(nextPay: string, cadence: Cadence, today: Date): number {
  const cycleLength = cycleDays(cadence);
  const d = daysUntil(nextPay, today);
  if (!Number.isFinite(d)) return cycleLength;
  // Payday today, not yet confirmed: the balance on screen does not include
  // that paycheck, so today is still the only day it has to cover.
  if (d >= 0) return Math.max(1, d);
  const intoCycle = ((d % cycleLength) + cycleLength) % cycleLength;
  return intoCycle === 0 ? cycleLength : intoCycle;
}
