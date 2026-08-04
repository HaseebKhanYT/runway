import {describe, expect, it} from 'vitest';
import {toIsoDate} from '../src/cycles';
import {onboardingCompleteSchema, profilePatchSchema} from '../src/schemas';

/**
 * A payload the onboarding door accepts, so each case varies only the field it
 * is about. `nextPay` is written from the clock rather than hard-coded: a
 * literal date would quietly turn into a date in the past, which is an
 * unrelated reason for these cases to start failing.
 */
function onboarding(overrides: Record<string, unknown> = {}) {
  return {
    balance: 6000,
    pay: 1700,
    cadence: 'biweekly' as const,
    nextPay: toIsoDate(new Date(), 14),
    bills: [],
    cards: [],
    cats: [],
    ...overrides,
  };
}

/** The message the schema attached to `nextPay`, or undefined if it passed. */
function nextPayError(body: Record<string, unknown>): string | undefined {
  const result = onboardingCompleteSchema.safeParse(body);
  if (result.success) return undefined;
  return result.error.issues.find((i) => i.path[0] === 'nextPay')?.message;
}

describe('the paycheck amount', () => {
  it('accepts zero through the settings door', () => {
    expect(profilePatchSchema.safeParse({payAmount: 0}).success).toBe(true);
  });

  it('accepts zero through the onboarding door as well', () => {
    // The two doors write the same column and used to disagree (#85): a
    // profile patch took zero and onboarding refused it.
    expect(onboardingCompleteSchema.safeParse(onboarding({pay: 0})).success).toBe(true);
  });

  it('refuses a negative amount at both doors', () => {
    expect(profilePatchSchema.safeParse({payAmount: -1}).success).toBe(false);
    expect(onboardingCompleteSchema.safeParse(onboarding({pay: -1})).success).toBe(false);
  });
});

describe('onboardingCompleteSchema', () => {
  it('accepts today and the far edge of the cycle', () => {
    expect(nextPayError(onboarding({nextPay: toIsoDate(new Date())}))).toBeUndefined();
    expect(nextPayError(onboarding({nextPay: toIsoDate(new Date(), 14)}))).toBeUndefined();
  });

  it('refuses a payday in the past rather than letting the math absorb it', () => {
    expect(nextPayError(onboarding({nextPay: toIsoDate(new Date(), -1)}))).toMatch(
      /already passed/,
    );
  });

  it('refuses a payday further out than one cycle', () => {
    expect(nextPayError(onboarding({nextPay: toIsoDate(new Date(), 15)}))).toMatch(/one pay cycle/);
    expect(
      nextPayError(onboarding({cadence: 'monthly', nextPay: toIsoDate(new Date(), 42)})),
    ).toMatch(/one pay cycle/);
  });

  it('bounds the payday against the cadence it was sent with', () => {
    const in10Days = toIsoDate(new Date(), 10);
    expect(nextPayError(onboarding({cadence: 'weekly', nextPay: in10Days}))).toMatch(
      /one pay cycle/,
    );
    expect(nextPayError(onboarding({cadence: 'monthly', nextPay: in10Days}))).toBeUndefined();
  });

  it('refuses a well-shaped string that names no calendar day', () => {
    expect(nextPayError(onboarding({nextPay: '2026-13-45'}))).toBeDefined();
  });
});

describe('profilePatchSchema', () => {
  it('refuses a well-shaped string that names no calendar day', () => {
    expect(profilePatchSchema.safeParse({nextPay: '2026-13-45'}).success).toBe(false);
    expect(profilePatchSchema.safeParse({nextPay: '2026-02-30'}).success).toBe(false);
  });

  it('still accepts a real date and an explicit null', () => {
    expect(profilePatchSchema.safeParse({nextPay: '2026-07-30'}).success).toBe(true);
    expect(profilePatchSchema.safeParse({nextPay: null}).success).toBe(true);
  });
});
