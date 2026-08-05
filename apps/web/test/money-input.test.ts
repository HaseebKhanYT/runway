import {describe, expect, it} from 'vitest';
import {parseMoneyInput} from '../src/lib/money-input';

describe('parseMoneyInput', () => {
  it('reads a cleared field as blank, not as zero', () => {
    // The bug: backspacing a balance to empty and clicking away stored 0 (#145).
    expect(parseMoneyInput('')).toEqual({status: 'blank'});
    expect(parseMoneyInput('   ')).toEqual({status: 'blank'});
  });

  it('still accepts a deliberate zero', () => {
    expect(parseMoneyInput('0')).toEqual({status: 'ok', value: 0});
    expect(parseMoneyInput('0.00')).toEqual({status: 'ok', value: 0});
  });

  it('parses plain amounts', () => {
    expect(parseMoneyInput('6000')).toEqual({status: 'ok', value: 6000});
    expect(parseMoneyInput('7500.25')).toEqual({status: 'ok', value: 7500.25});
  });

  it('accepts a bare leading or trailing point', () => {
    expect(parseMoneyInput('12.')).toEqual({status: 'ok', value: 12});
    expect(parseMoneyInput('.5')).toEqual({status: 'ok', value: 0.5});
  });

  it('ignores padding around a valid number', () => {
    expect(parseMoneyInput('  1234.50  ')).toEqual({status: 'ok', value: 1234.5});
  });

  it('refuses what parseFloat would silently truncate', () => {
    // parseFloat reads a valid prefix: '1-2' became 1 and '1.2.3' became 1.2.
    expect(parseMoneyInput('1-2').status).toBe('invalid');
    expect(parseMoneyInput('1.2.3').status).toBe('invalid');
    expect(parseMoneyInput('12-').status).toBe('invalid');
  });

  it('refuses a sign or point with no digits', () => {
    expect(parseMoneyInput('-').status).toBe('invalid');
    expect(parseMoneyInput('.').status).toBe('invalid');
    expect(parseMoneyInput('-.').status).toBe('invalid');
  });

  it('refuses a number too big to be finite', () => {
    expect(parseMoneyInput('9'.repeat(400)).status).toBe('invalid');
  });

  it('allows negatives by default — a balance can be overdrawn', () => {
    expect(parseMoneyInput('-500')).toEqual({status: 'ok', value: -500});
    expect(parseMoneyInput('-500', {allowNegative: true})).toEqual({status: 'ok', value: -500});
  });

  it('refuses a negative where the API would, with its own message', () => {
    const negative = parseMoneyInput('-500', {allowNegative: false});
    const malformed = parseMoneyInput('1-2', {allowNegative: false});
    expect(negative.status).toBe('invalid');
    expect(malformed.status).toBe('invalid');
    expect(negative).not.toEqual(malformed);
  });

  it('gives every refusal something short to show the user', () => {
    for (const raw of ['1-2', '1.2.3', '-', '.', '-500']) {
      const parsed = parseMoneyInput(raw, {allowNegative: false});
      expect(parsed.status).toBe('invalid');
      if (parsed.status !== 'invalid') continue;
      expect(parsed.message.length).toBeGreaterThan(0);
      expect(parsed.message.length).toBeLessThan(40);
    }
  });
});
