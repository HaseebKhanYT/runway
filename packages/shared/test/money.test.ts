import {describe, expect, it} from 'vitest';
import {d, dayF, fm, ordSuf, round2} from '../src/money';

describe('fm', () => {
  it('formats with cents by default', () => {
    expect(fm(1234.5)).toBe('$1,234.50');
  });
  it('uses U+2212 minus for negatives', () => {
    expect(fm(-950)).toBe('−$950.00');
  });
  it('rounds when cents are off', () => {
    expect(fm(1234.5, false)).toBe('$1,235');
  });
  it('formats zero', () => {
    expect(fm(0)).toBe('$0.00');
  });
});

describe('dayF', () => {
  it('no cents, no separators', () => {
    expect(dayF(17)).toBe('$17');
  });
  it('ASCII hyphen for negatives', () => {
    expect(dayF(-4)).toBe('-$4');
  });
});

describe('d', () => {
  const today = new Date('2026-07-16T12:00:00');
  it('formats short month/day offsets from today', () => {
    expect(d(14, today)).toBe('Jul 30');
    expect(d(0, today)).toBe('Jul 16');
    expect(d(-6, today)).toBe('Jul 10');
  });
});

describe('ordSuf', () => {
  it('handles standard suffixes', () => {
    expect(ordSuf(1)).toBe('st');
    expect(ordSuf(2)).toBe('nd');
    expect(ordSuf(3)).toBe('rd');
    expect(ordSuf(4)).toBe('th');
    expect(ordSuf(11)).toBe('th');
    expect(ordSuf(12)).toBe('th');
    expect(ordSuf(13)).toBe('th');
    expect(ordSuf(21)).toBe('st');
    expect(ordSuf(22)).toBe('nd');
    expect(ordSuf(23)).toBe('rd');
  });
});

describe('round2', () => {
  it('rounds to cents', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1540.004)).toBe(1540);
  });
});
