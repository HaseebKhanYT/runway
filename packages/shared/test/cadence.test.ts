import {describe, expect, it} from 'vitest';
import type {z} from 'zod';
import {cycleDays, type Cadence} from '../src/cycles';
import {cadenceSchema, onboardingCompleteSchema, profilePatchSchema} from '../src/schemas';

/**
 * Written out by hand rather than read off `cadenceSchema`: a list derived from
 * the thing under test shrinks silently along with it, which is exactly the
 * failure these tests exist to catch.
 */
const EVERY_CADENCE: Cadence[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];

/** Tomorrow, so the payload stays a plausible next payday whenever this runs. */
function tomorrowIso(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function onboardingBody(cadence: Cadence) {
  return {
    balance: 1200,
    pay: 1700,
    cadence,
    nextPay: tomorrowIso(),
    bills: [],
    cards: [],
    cats: [],
  };
}

describe('cadenceSchema', () => {
  it('accepts every cadence the domain defines', () => {
    for (const cadence of EVERY_CADENCE) {
      expect(cadenceSchema.parse(cadence)).toBe(cadence);
    }
  });

  it('rejects a cadence the math has no cycle length for', () => {
    expect(cadenceSchema.safeParse('quarterly').success).toBe(false);
    expect(cadenceSchema.safeParse('').success).toBe(false);
  });

  it('parses to the type the cycle math takes', () => {
    // Compile-time as much as runtime: `cycleDays` only accepts a `Cadence`,
    // so this stops building if the schema widens past the union.
    expect(cycleDays(cadenceSchema.parse('semimonthly'))).toBe(15);
  });

  it('is exactly the Cadence union, in both directions', () => {
    type SchemaCadence = z.infer<typeof cadenceSchema>;
    const mutuallyAssignable: [
      SchemaCadence extends Cadence ? true : false,
      Cadence extends SchemaCadence ? true : false,
    ] = [true, true];
    expect(mutuallyAssignable).toEqual([true, true]);
  });
});

describe('the two doors into the cadence column', () => {
  // Settings patches the profile; onboarding writes the same column once, at
  // setup. They enumerated their own cadences until #67, and onboarding's list
  // was one short, so a semimonthly earner was silently filed as biweekly.
  it('both accept every cadence', () => {
    for (const cadence of EVERY_CADENCE) {
      expect(profilePatchSchema.safeParse({cadence}).success).toBe(true);
      expect(onboardingCompleteSchema.safeParse(onboardingBody(cadence)).success).toBe(true);
    }
  });

  it('both reject the same non-cadence', () => {
    expect(profilePatchSchema.safeParse({cadence: 'quarterly'}).success).toBe(false);
    expect(onboardingCompleteSchema.safeParse(onboardingBody('quarterly' as Cadence)).success).toBe(
      false,
    );
  });
});
