import {describe, expect, it} from 'vitest';
import {onboardingCompleteSchema, profilePatchSchema} from '../src/schemas';

/** A payload the onboarding door accepts, so each case varies only `pay`. */
const onboarding = {
  balance: 500,
  pay: 2000,
  cadence: 'biweekly' as const,
  nextPay: '2026-08-14',
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
