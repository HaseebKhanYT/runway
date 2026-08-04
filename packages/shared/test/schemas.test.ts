import {describe, expect, it} from 'vitest';
import {onboardingCompleteSchema, profilePatchSchema} from '../src/schemas';

/**
 * A payday a week out, written from the clock rather than hard-coded. Only
 * `pay` is under test here, and a literal date would quietly turn into a date
 * in the past — an unrelated reason for these cases to start failing.
 */
function inAWeek(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** A payload the onboarding door accepts, so each case varies only `pay`. */
const onboarding = {
  balance: 500,
  pay: 2000,
  cadence: 'biweekly' as const,
  nextPay: inAWeek(),
  bills: [],
  cards: [],
  cats: [],
};

describe('the paycheck amount', () => {
  it('accepts zero through the settings door', () => {
    expect(profilePatchSchema.safeParse({payAmount: 0}).success).toBe(true);
  });

  it('accepts zero through the onboarding door as well', () => {
    // The two doors write the same column and used to disagree (#85): a
    // profile patch took zero and onboarding refused it.
    expect(onboardingCompleteSchema.safeParse({...onboarding, pay: 0}).success).toBe(true);
  });

  it('refuses a negative amount at both doors', () => {
    expect(profilePatchSchema.safeParse({payAmount: -1}).success).toBe(false);
    expect(onboardingCompleteSchema.safeParse({...onboarding, pay: -1}).success).toBe(false);
  });
});
