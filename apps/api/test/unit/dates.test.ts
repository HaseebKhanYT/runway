import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {advanceCycle, nextDueDate, parseIsoDateUtc} from '../../src/dates';

const iso = (d: Date): string => d.toISOString().slice(0, 10);

describe('test environment', () => {
  it('runs under UTC', () => {
    // Tripwire. nextDueDate reads local date parts off `today`, so every
    // expectation below is zone-dependent; vitest.unit.config.ts pins TZ=UTC.
    // If that config regresses, this fails first and names the cause.
    expect(new Date().getTimezoneOffset()).toBe(0);
  });
});

describe('nextDueDate', () => {
  const TODAY = new Date('2026-07-16T12:00:00');

  it('counts today as still due', () => {
    expect(iso(nextDueDate(16, TODAY))).toBe('2026-07-16');
  });

  it('rolls to next month once the day has passed', () => {
    expect(iso(nextDueDate(5, TODAY))).toBe('2026-08-05');
  });

  it('keeps day 31 in a 31-day month', () => {
    // July has 31 days, so no clamp applies.
    expect(iso(nextDueDate(31, TODAY))).toBe('2026-07-31');
  });

  it('clamps day 31 to the end of a 30-day month', () => {
    expect(iso(nextDueDate(31, new Date('2026-04-10T12:00:00')))).toBe('2026-04-30');
  });

  it('clamps to 28 in a non-leap February', () => {
    // 2026 is not a leap year; last of Feb = 28, so min(31, 28) = 28.
    expect(iso(nextDueDate(31, new Date('2026-02-10T12:00:00')))).toBe('2026-02-28');
  });

  it('allows 29 in a leap February', () => {
    // 2028 is a leap year; last of Feb = 29, so min(29, 29) = 29.
    expect(iso(nextDueDate(29, new Date('2028-02-10T12:00:00')))).toBe('2028-02-29');
  });

  it('rolls across a year boundary', () => {
    // clamp(2026, 12) — month index 12 normalises to January 2027.
    expect(iso(nextDueDate(5, new Date('2026-12-20T12:00:00')))).toBe('2027-01-05');
  });
});

describe('nextDueDate under a non-UTC zone', () => {
  const original = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles';
  });

  afterAll(() => {
    process.env.TZ = original;
  });

  it('self-verifies the zone flip took effect', () => {
    // 2026-03-01 is PST (UTC-8), so the offset is 480 minutes.
    expect(new Date('2026-03-01T02:00:00Z').getTimezoneOffset()).toBe(480);
  });

  it('returns a date in the past because local and UTC parts are mixed', () => {
    // Documents current behaviour, not desired. nextDueDate reads
    // today.getFullYear()/getMonth()/getDate() (LOCAL) but builds the result
    // with Date.UTC and compares via getUTCDate(). At this instant the local
    // date is 2026-02-28 while the UTC date is 2026-03-01, so the function
    // anchors to February and returns a due date that has already passed.
    // Under TZ=UTC the same call returns 2026-03-28.
    const at = new Date('2026-03-01T02:00:00Z');
    expect(iso(nextDueDate(28, at))).toBe('2026-02-28');
    expect(iso(nextDueDate(28, at)) < at.toISOString().slice(0, 10)).toBe(true);
  });
});

describe('parseIsoDateUtc', () => {
  it('anchors an ISO day to UTC midnight', () => {
    expect(parseIsoDateUtc('2026-07-16').toISOString()).toBe('2026-07-16T00:00:00.000Z');
  });

  it('yields an invalid date for a malformed day', () => {
    expect(Number.isNaN(parseIsoDateUtc('nope').getTime())).toBe(true);
  });
});

describe('advanceCycle', () => {
  it('advances weekly by 7 days', () => {
    expect(advanceCycle('2026-07-16', 'weekly')).toBe('2026-07-23');
  });

  it('advances semimonthly by 15 days', () => {
    expect(advanceCycle('2026-07-16', 'semimonthly')).toBe('2026-07-31');
  });

  it('advances monthly by one calendar month', () => {
    expect(advanceCycle('2026-07-16', 'monthly')).toBe('2026-08-16');
  });

  it('advances biweekly by 14 days', () => {
    expect(advanceCycle('2026-07-16', 'biweekly')).toBe('2026-07-30');
  });

  it('falls back to 14 days for an unknown cadence', () => {
    // The switch default swallows anything unrecognised into biweekly.
    expect(advanceCycle('2026-07-16', 'nope')).toBe('2026-07-30');
  });

  it('skips February entirely from a 31st', () => {
    // Documents current behaviour, not desired: setUTCMonth(+1) makes
    // "2026-02-31", which overflows by 3 days (Feb 2026 has 28) to March 3.
    expect(advanceCycle('2026-01-31', 'monthly')).toBe('2026-03-03');
  });

  it('throws on a malformed input date', () => {
    // parseIsoDateUtc yields an Invalid Date; toISOString then throws.
    expect(() => advanceCycle('nope', 'weekly')).toThrow(RangeError);
  });
});
