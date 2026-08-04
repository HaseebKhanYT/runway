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
