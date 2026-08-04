import {describe, expect, it} from 'vitest';
import {
  cycleDays,
  cyclesPerMonth,
  DAYS_PER_MONTH,
  daysUntil,
  isCadence,
  parseCadence,
  type Cadence,
} from '../src/cycles';

describe('cycleDays', () => {
  it('maps every cadence', () => {
    expect(cycleDays('weekly')).toBe(7);
    expect(cycleDays('biweekly')).toBe(14);
    expect(cycleDays('semimonthly')).toBe(15);
    expect(cycleDays('monthly')).toBe(30);
  });

  it('throws on an unrecognised cadence rather than assuming biweekly', () => {
    expect(() => cycleDays('fortnightly' as Cadence)).toThrow(/unknown pay cadence/);
    expect(() => cycleDays('' as Cadence)).toThrow(/unknown pay cadence/);
  });
});

describe('DAYS_PER_MONTH', () => {
  it('is the average Gregorian month', () => {
    expect(DAYS_PER_MONTH).toBe(30.44);
    // 365.2425 / 12 = 30.4369, to two places.
    expect(DAYS_PER_MONTH).toBeCloseTo(365.2425 / 12, 2);
  });
});

describe('cyclesPerMonth', () => {
  it('is exact for the calendar-anchored cadences', () => {
    // A monthly earner is paid 12 times a year and pays 12 monthly bills a
    // year, so one cycle carries exactly one month of bills. 30 / 30.44 would
    // carry 0.9855 of one.
    expect(cyclesPerMonth('monthly')).toBe(1);
    expect(cyclesPerMonth('semimonthly')).toBe(2);
  });

  it('prorates the day-anchored cadences by the average month', () => {
    expect(cyclesPerMonth('weekly')).toBe(DAYS_PER_MONTH / 7);
    expect(cyclesPerMonth('biweekly')).toBe(DAYS_PER_MONTH / 14);
  });

  it('implies the paychecks a year each cadence actually pays', () => {
    expect(cyclesPerMonth('monthly') * 12).toBe(12);
    expect(cyclesPerMonth('semimonthly') * 12).toBe(24);
    // Every 14 and every 7 days over 365.28 days, so a fraction over 26 and 52.
    expect(cyclesPerMonth('biweekly') * 12).toBeCloseTo(26.09, 2);
    expect(cyclesPerMonth('weekly') * 12).toBeCloseTo(52.18, 2);
  });

  it('throws on an unrecognised cadence', () => {
    expect(() => cyclesPerMonth('fortnightly' as Cadence)).toThrow(/unknown pay cadence/);
  });
});

describe('parseCadence', () => {
  it('accepts the four cadences the math knows', () => {
    expect(parseCadence('weekly')).toBe('weekly');
    expect(parseCadence('biweekly')).toBe('biweekly');
    expect(parseCadence('semimonthly')).toBe('semimonthly');
    expect(parseCadence('monthly')).toBe('monthly');
  });

  it('rejects anything else, naming the value', () => {
    expect(() => parseCadence('Monthly')).toThrow(/"Monthly"/);
    expect(() => parseCadence('fortnightly')).toThrow(/unknown pay cadence/);
    expect(() => parseCadence('')).toThrow(/unknown pay cadence/);
    expect(() => parseCadence(null)).toThrow(/unknown pay cadence/);
    expect(() => parseCadence(undefined)).toThrow(/unknown pay cadence/);
    expect(() => parseCadence(14)).toThrow(/unknown pay cadence/);
  });

  it('narrows without throwing through isCadence', () => {
    expect(isCadence('semimonthly')).toBe(true);
    expect(isCadence('fortnightly')).toBe(false);
    expect(isCadence(null)).toBe(false);
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
