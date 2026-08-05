export const MS_PER_DAY = 86400000;

/** Midnight of the given date in local time. */
export function midnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export const CADENCES = ['weekly', 'biweekly', 'semimonthly', 'monthly'] as const;

export type Cadence = (typeof CADENCES)[number];

export function isCadence(value: unknown): value is Cadence {
  return typeof value === 'string' && (CADENCES as readonly string[]).includes(value);
}

/**
 * Narrow an untrusted cadence — a database column, a legacy payload — to the
 * four the math knows. It throws instead of defaulting: every number this
 * package computes is scaled by the cadence, so guessing produces a plausible
 * figure for a cycle the user is not actually paid on, and nothing downstream
 * can tell that apart from the truth.
 */
export function parseCadence(value: unknown): Cadence {
  if (isCadence(value)) return value;
  throw new Error(
    `unknown pay cadence ${JSON.stringify(value)}; expected one of ${CADENCES.join(', ')}`,
  );
}

/**
 * Whole days in one pay cycle, for scheduling: how far ahead the next payday
 * is, and how many paydays fall before a goal's due date. `monthly` is 30 here
 * because those callers count in days and a day count has to be a whole
 * number — it is not a claim about the length of a month. Money that converts
 * between a cycle and a calendar month goes through `cyclesPerMonth`.
 */
export function cycleDays(c: Cadence): 7 | 14 | 15 | 30 {
  switch (c) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'semimonthly':
      return 15;
    case 'monthly':
      return 30;
    default: {
      const unreachable: never = c;
      throw new Error(`unknown pay cadence ${JSON.stringify(unreachable)}`);
    }
  }
}

/**
 * Paychecks that land in one calendar month — the divisor that splits a
 * month's bills across the cycles that have to carry them.
 *
 * `monthly` and `semimonthly` are anchored to the calendar rather than to a
 * day count: 12 and 24 pay dates a year, whatever the month's length, which is
 * also how `advanceCycle` rolls a monthly payday forward. Their share of a
 * monthly bill is therefore exactly 1 and exactly 1/2. Deriving it from
 * `cycleDays` instead would divide 30 or 15 by an average month of 30.44 and
 * drop 1.45% of every bill.
 *
 * `weekly` and `biweekly` really are anchored to a fixed number of days — a
 * biweekly earner gets 26 paychecks over 365.28 days, not 24 — so for those
 * two the day count over the average month is the right answer.
 */
export function cyclesPerMonth(c: Cadence): number {
  switch (c) {
    case 'monthly':
      return 1;
    case 'semimonthly':
      return 2;
    case 'weekly':
    case 'biweekly':
      return DAYS_PER_MONTH / cycleDays(c);
    default: {
      const unreachable: never = c;
      throw new Error(`unknown pay cadence ${JSON.stringify(unreachable)}`);
    }
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
 * Where the payday on file falls on the calendar, in whole days from `today` —
 * so a payday that is today is `0`. This is the question every rendering of
 * the date itself asks: which day to print, and how far away to call it.
 *
 * A stored payday only moves when the user confirms a paycheck landed, so it
 * slides into the past whenever they simply do not open the app. This function
 * reads that as the cycle having turned over — the paycheck came and the next
 * one is a cycle later — and rolls the date forward by whole cycles rather than
 * naming a day that has already gone. Clamping to one day instead, as this used
 * to, also told `daysToNextPayday` to divide the whole balance by a single day
 * and report it as spendable today.
 *
 * A payday further out than one cycle is returned as-is rather than clamped
 * down to `cycleDays`: if the money really is that far away it has to stretch
 * that far, and honouring the date can only ever lower the daily number, never
 * inflate it.
 */
export function paydayOffset(nextPay: string, cadence: Cadence, today: Date): number {
  const cycleLength = cycleDays(cadence);
  const d = daysUntil(nextPay, today);
  if (!Number.isFinite(d)) return cycleLength;
  if (d >= 0) return d;
  const intoCycle = ((d % cycleLength) + cycleLength) % cycleLength;
  return intoCycle === 0 ? cycleLength : intoCycle;
}

/**
 * How many days the balance on screen has to cover before the next paycheck —
 * the divisor under every per-day figure, which is why it is never less than
 * one.
 *
 * That floor is the whole of the difference from `paydayOffset`, and it bites
 * on exactly one input: a payday that is today and has not been confirmed. The
 * balance on screen does not include that paycheck yet, so today is still a day
 * it has to cover, and dividing a whole balance by no days at all would report
 * all of it as spendable now.
 */
export function daysToNextPayday(nextPay: string, cadence: Cadence, today: Date): number {
  return Math.max(1, paydayOffset(nextPay, cadence, today));
}
