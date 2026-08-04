import {describe, expect, it} from 'vitest';
import {
  cycleDays,
  daysToNextPayday,
  daysUntil,
  isCalendarDate,
  maxDaysToPayday,
  nextPayProblem,
  toIsoDate,
} from '../src/cycles';

describe('cycleDays', () => {
  it('maps every cadence', () => {
    expect(cycleDays('weekly')).toBe(7);
    expect(cycleDays('biweekly')).toBe(14);
    expect(cycleDays('semimonthly')).toBe(15);
    expect(cycleDays('monthly')).toBe(30);
  });
});

describe('daysUntil', () => {
  const today = new Date('2026-07-16T12:00:00');
  it('counts midnight-to-midnight', () => {
    expect(daysUntil('2026-07-30', today)).toBe(14);
    expect(daysUntil('2026-07-16', today)).toBe(0);
    expect(daysUntil('2026-07-10', today)).toBe(-6);
  });
});

describe('toIsoDate', () => {
  const today = new Date('2026-07-16T23:30:00');
  it('reads the local calendar day, not the UTC one', () => {
    expect(toIsoDate(today)).toBe('2026-07-16');
  });

  it('offsets across a month boundary', () => {
    expect(toIsoDate(today, 16)).toBe('2026-08-01');
    expect(toIsoDate(today, -16)).toBe('2026-06-30');
  });
});

describe('isCalendarDate', () => {
  it('accepts real days', () => {
    expect(isCalendarDate('2026-07-16')).toBe(true);
    expect(isCalendarDate('2028-02-29')).toBe(true); // leap year
  });

  it('rejects a well-shaped string that names no day', () => {
    expect(isCalendarDate('2026-13-45')).toBe(false);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-00-10')).toBe(false);
    expect(isCalendarDate('2026-07-00')).toBe(false);
    expect(isCalendarDate('2026-2-9')).toBe(false);
    expect(isCalendarDate('')).toBe(false);
  });
});

describe('maxDaysToPayday', () => {
  it('allows the longest gap the cadence can actually span', () => {
    expect(maxDaysToPayday('weekly')).toBe(7);
    expect(maxDaysToPayday('biweekly')).toBe(14);
    expect(maxDaysToPayday('semimonthly')).toBe(16);
    expect(maxDaysToPayday('monthly')).toBe(31);
  });
});

describe('nextPayProblem', () => {
  const today = new Date('2026-07-16T12:00:00');

  it('accepts today and the far edge of one cycle', () => {
    expect(nextPayProblem('2026-07-16', 'biweekly', today)).toBeNull();
    expect(nextPayProblem('2026-07-30', 'biweekly', today)).toBeNull();
    // A monthly earner setting up on the 16th, paid on the 16th next month.
    expect(nextPayProblem('2026-08-16', 'monthly', today)).toBeNull();
  });

  it('refuses a day that has already passed', () => {
    expect(nextPayProblem('2026-07-15', 'biweekly', today)).toMatch(/already passed/);
  });

  it('refuses a day more than one cycle away', () => {
    expect(nextPayProblem('2026-07-31', 'biweekly', today)).toMatch(/one pay cycle/);
    // Six weeks out for a monthly earner — the case that used to be clamped.
    expect(nextPayProblem('2026-08-27', 'monthly', today)).toMatch(/one pay cycle/);
  });

  it('refuses a string that is not a date', () => {
    expect(nextPayProblem('2026-13-45', 'biweekly', today)).toMatch(/not a real date/);
  });
});

describe('daysToNextPayday', () => {
  const today = new Date('2026-07-16T12:00:00');

  it('counts a future payday exactly', () => {
    expect(daysToNextPayday('2026-07-26', 'biweekly', today)).toBe(10);
  });

  it('honours a payday further out than one cycle instead of clamping it', () => {
    expect(daysToNextPayday('2026-08-27', 'monthly', today)).toBe(42);
  });

  it('treats a payday that has not been confirmed today as one day', () => {
    expect(daysToNextPayday('2026-07-16', 'biweekly', today)).toBe(1);
  });

  it('rolls a stale payday forward by whole cycles', () => {
    expect(daysToNextPayday('2026-07-15', 'biweekly', today)).toBe(13);
    expect(daysToNextPayday('2026-07-02', 'biweekly', today)).toBe(14); // exactly one cycle ago
    expect(daysToNextPayday('2026-07-01', 'biweekly', today)).toBe(13);
    expect(daysToNextPayday('2026-05-16', 'monthly', today)).toBe(29);
    expect(daysToNextPayday('2026-07-15', 'weekly', today)).toBe(6);
  });

  it('falls back to the cycle length when the date cannot be parsed', () => {
    expect(daysToNextPayday('2026-13-45', 'biweekly', today)).toBe(14);
  });
});
