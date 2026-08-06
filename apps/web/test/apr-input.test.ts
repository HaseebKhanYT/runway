import {describe, expect, it} from 'vitest';
import {cardUpsertSchema} from '@runway/shared';
import {parseAprInput} from '../src/lib/apr-input';

describe('parseAprInput', () => {
  it('refuses an APR the API would refuse', () => {
    // The bug: 199 was accepted on step 4 and only rejected by
    // POST /onboarding/complete, five steps later, as an unshown 400 (#59).
    expect(parseAprInput('199').status).toBe('invalid');
    expect(parseAprInput('100').status).toBe('invalid');
    expect(parseAprInput('99.5').status).toBe('invalid');
  });

  it('accepts the bound itself and everything under it', () => {
    expect(parseAprInput('99')).toEqual({status: 'ok', value: 99});
    expect(parseAprInput('19.99')).toEqual({status: 'ok', value: 19.99});
    expect(parseAprInput('0')).toEqual({status: 'ok', value: 0});
    expect(parseAprInput('.5')).toEqual({status: 'ok', value: 0.5});
  });

  it('still reads a blank field as 0, as it did before', () => {
    expect(parseAprInput('')).toEqual({status: 'ok', value: 0});
    expect(parseAprInput('   ')).toEqual({status: 'ok', value: 0});
  });

  it('refuses what parseFloat would silently truncate', () => {
    // parseFloat('1.2.3') is 1.2, so a bound checked on it bounds a value the
    // user never typed.
    expect(parseAprInput('1.2.3').status).toBe('invalid');
    expect(parseAprInput('.').status).toBe('invalid');
    expect(parseAprInput('..').status).toBe('invalid');
  });

  it('refuses a negative APR', () => {
    expect(parseAprInput('-5').status).toBe('invalid');
  });

  it('names the bound the schema declares rather than a copy of it', () => {
    const above = parseAprInput('199');
    const below = parseAprInput('-5');
    expect(above.status).toBe('invalid');
    expect(below.status).toBe('invalid');
    if (above.status !== 'invalid' || below.status !== 'invalid') return;
    expect(above.message).toContain(`${cardUpsertSchema.shape.apr.maxValue}%`);
    expect(below.message).toContain(`${cardUpsertSchema.shape.apr.minValue}%`);
  });

  it('accepts no value the card schema would reject', () => {
    const typed = ['', '   ', '0', '.5', '19.99', '99', '99.5', '100', '199', '1.2.3', '.', '-5'];
    for (const raw of typed) {
      const parsed = parseAprInput(raw);
      if (parsed.status !== 'ok') {
        expect(parsed.message.endsWith('.')).toBe(true);
        continue;
      }
      expect(cardUpsertSchema.shape.apr.safeParse(parsed.value).success).toBe(true);
    }
  });
});
