import {describe, expect, it} from 'vitest';
import {cycleDays, daysUntil} from '../src/cycles';

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
