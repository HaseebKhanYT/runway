import {describe, expect, it} from 'vitest';
import {onboardingBalance, onboardingPaycheck} from '../src/lib/onboarding-money';

/**
 * Everything the field's own filter lets through that `parseFloat` would have
 * read a prefix of: `1.2.3` became 1.2, `1-2` became 1, `12-` became 12, and a
 * lone point became NaN. All of it is typeable — the filter strips everything
 * but digits and points, and permits more than one point.
 */
const TRUNCATED = ['1.2.3', '1-2', '.', '..', '12-'];

const TOO_BIG = '9'.repeat(400);

describe('onboardingBalance', () => {
  it('reads an untouched field as blank, not as a problem', () => {
    // Blank keeps Next disabled, which is the affordance the step always had.
    expect(onboardingBalance('')).toEqual({status: 'blank'});
    expect(onboardingBalance('   ')).toEqual({status: 'blank'});
  });

  it('accepts a plain amount', () => {
    expect(onboardingBalance('6000')).toEqual({status: 'ok', value: 6000});
    expect(onboardingBalance('6000.42')).toEqual({status: 'ok', value: 6000.42});
  });

  it('accepts an empty account', () => {
    // `balance` is money.nonnegative(): zero is a real balance, not a refusal.
    expect(onboardingBalance('0')).toEqual({status: 'ok', value: 0});
    expect(onboardingBalance('0.00')).toEqual({status: 'ok', value: 0});
  });

  it('keeps the bare-point contract parseMoneyInput already has', () => {
    expect(onboardingBalance('12.')).toEqual({status: 'ok', value: 12});
    expect(onboardingBalance('.5')).toEqual({status: 'ok', value: 0.5});
  });

  it('refuses what parseFloat would silently truncate', () => {
    // The bug: `1.2.3` became 1.2, Next stayed enabled, setup stored $1.20.
    for (const raw of TRUNCATED) expect(onboardingBalance(raw).status).toBe('problem');
  });

  it('refuses a negative, as the schema does', () => {
    expect(onboardingBalance('-500').status).toBe('problem');
  });

  it('refuses a number too big to be finite, and says which way it is wrong', () => {
    const judged = onboardingBalance(TOO_BIG);
    expect(judged.status).toBe('problem');
    if (judged.status !== 'problem') return;
    expect(judged.message).toContain('too big');
  });

  it('names the field in every refusal', () => {
    for (const raw of [...TRUNCATED, '-500', TOO_BIG]) {
      const judged = onboardingBalance(raw);
      expect(judged.status).toBe('problem');
      if (judged.status !== 'problem') continue;
      expect(judged.message).toContain('balance');
    }
  });
});

describe('onboardingPaycheck', () => {
  it('reads an untouched field as blank, not as a problem', () => {
    expect(onboardingPaycheck('')).toEqual({status: 'blank'});
    expect(onboardingPaycheck('   ')).toEqual({status: 'blank'});
  });

  it('accepts a plain amount', () => {
    expect(onboardingPaycheck('1700')).toEqual({status: 'ok', value: 1700});
    expect(onboardingPaycheck('1700.50')).toEqual({status: 'ok', value: 1700.5});
  });

  it('refuses zero, which step 2 always did', () => {
    // The gate was `pay > 0`. The rule is unchanged; only the silence is.
    expect(onboardingPaycheck('0').status).toBe('problem');
    expect(onboardingPaycheck('0.00').status).toBe('problem');
  });

  it('keeps the bare-point contract parseMoneyInput already has', () => {
    expect(onboardingPaycheck('12.')).toEqual({status: 'ok', value: 12});
    expect(onboardingPaycheck('.5')).toEqual({status: 'ok', value: 0.5});
  });

  it('refuses what parseFloat would silently truncate', () => {
    for (const raw of TRUNCATED) expect(onboardingPaycheck(raw).status).toBe('problem');
  });

  it('refuses a number too big to be finite, and says which way it is wrong', () => {
    const judged = onboardingPaycheck(TOO_BIG);
    expect(judged.status).toBe('problem');
    if (judged.status !== 'problem') return;
    expect(judged.message).toContain('too big');
  });

  it('names the field in every refusal, zero included', () => {
    for (const raw of [...TRUNCATED, '0', '-500', TOO_BIG]) {
      const judged = onboardingPaycheck(raw);
      expect(judged.status).toBe('problem');
      if (judged.status !== 'problem') continue;
      expect(judged.message).toContain('paycheck');
    }
  });
});
