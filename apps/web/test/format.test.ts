import {describe, expect, it} from 'vitest';
import {cadenceSchema} from '@runway/shared';
import {
  CADENCE_LABELS,
  CADENCE_OPTIONS,
  formatShortDate,
  formatDayAmount,
  formatMoney,
  ordinalSuffix,
} from '../src/lib/format';

describe('formatMoney', () => {
  it('formats with cents by default', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });
  it('uses U+2212 minus for negatives', () => {
    expect(formatMoney(-950)).toBe('−$950.00');
  });
  it('rounds when cents are off', () => {
    expect(formatMoney(1234.5, false)).toBe('$1,235');
  });
  it('formats zero', () => {
    expect(formatMoney(0)).toBe('$0.00');
  });
});

describe('formatDayAmount', () => {
  it('no cents, no separators', () => {
    expect(formatDayAmount(17)).toBe('$17');
  });
  it('ASCII hyphen for negatives', () => {
    expect(formatDayAmount(-4)).toBe('-$4');
  });
});

describe('formatShortDate', () => {
  const today = new Date('2026-07-16T12:00:00');
  it('formats short month/day offsets from today', () => {
    expect(formatShortDate(14, today)).toBe('Jul 30');
    expect(formatShortDate(0, today)).toBe('Jul 16');
    expect(formatShortDate(-6, today)).toBe('Jul 10');
  });
});

describe('CADENCE_OPTIONS', () => {
  it('offers every cadence the API will accept', () => {
    // The pickers render this list, so a cadence missing here is a cadence the
    // user cannot choose even though the server would store it (#67).
    for (const [value] of CADENCE_OPTIONS) {
      expect(cadenceSchema.safeParse(value).success).toBe(true);
    }
    expect(CADENCE_OPTIONS.map(([value]) => value)).toEqual([
      'weekly',
      'biweekly',
      'semimonthly',
      'monthly',
    ]);
  });

  it('names semimonthly as something other than every 2 weeks', () => {
    expect(CADENCE_LABELS.semimonthly).toBe('Twice a month');
    expect(new Set(Object.values(CADENCE_LABELS)).size).toBe(CADENCE_OPTIONS.length);
  });
});

describe('ordinalSuffix', () => {
  it('handles standard suffixes', () => {
    expect(ordinalSuffix(1)).toBe('st');
    expect(ordinalSuffix(2)).toBe('nd');
    expect(ordinalSuffix(3)).toBe('rd');
    expect(ordinalSuffix(4)).toBe('th');
    expect(ordinalSuffix(11)).toBe('th');
    expect(ordinalSuffix(12)).toBe('th');
    expect(ordinalSuffix(13)).toBe('th');
    expect(ordinalSuffix(21)).toBe('st');
    expect(ordinalSuffix(22)).toBe('nd');
    expect(ordinalSuffix(23)).toBe('rd');
  });
});
