import {describe, expect, it} from 'vitest';
import {ApiError} from '../src/lib/api-error';
import {describeOnboardingFailure} from '../src/lib/onboarding-submit';

const PATH = '/onboarding/complete';

/** The `@hono/zod-validator` envelope, as captured from the running API. */
const zodBody = (issues: unknown[]) =>
  JSON.stringify({success: false, error: {issues, name: 'ZodError'}});

const refused = (status: number, body?: string) => new ApiError('rejected', PATH, {status, body});

describe('describeOnboardingFailure', () => {
  it('names the answer, its row, its step and the server’s own reason', () => {
    // Captured live from the running API: a card added at 150% APR against
    // `onboardingCompleteFields`' max of 99.
    const {headline, detail} = describeOnboardingFailure(
      refused(
        400,
        zodBody([
          {
            code: 'too_big',
            maximum: 99,
            type: 'number',
            inclusive: true,
            exact: false,
            message: 'Number must be less than or equal to 99',
            path: ['cards', 0, 'apr'],
          },
        ]),
      ),
    );
    expect(headline).toBe("Check card 1's APR");
    expect(detail).toContain("card 1's APR");
    expect(detail).toContain('Step 4');
    expect(detail).toContain('“Number must be less than or equal to 99”');
  });

  it('counts the rows from one, the way the screen does', () => {
    const {headline} = describeOnboardingFailure(
      refused(
        400,
        zodBody([{code: 'too_small', message: 'Required', path: ['bills', 2, 'amount']}]),
      ),
    );
    expect(headline).toBe("Check bill 3's amount");
  });

  it('sends the next-payday rule back to step 2 with its sentence intact', () => {
    // `onboardingCompleteSchema.superRefine` raises a custom issue whose
    // message is `nextPayProblem`'s own human sentence (#166).
    const {headline, detail} = describeOnboardingFailure(
      refused(
        400,
        zodBody([{code: 'custom', message: 'That day has already passed.', path: ['nextPay']}]),
      ),
    );
    expect(headline).toBe('Check your next payday');
    expect(detail).toContain('Step 2');
    expect(detail).toContain('“That day has already passed.”');
    // The message already ends in a stop; the copy must not add a second one.
    expect(detail).not.toContain('passed.”.');
  });

  it('points a root-level answer at the step it was typed on', () => {
    const balance = describeOnboardingFailure(
      refused(
        400,
        zodBody([{code: 'too_small', message: 'Number must be >= 0', path: ['balance']}]),
      ),
    );
    expect(balance.headline).toBe('Check your starting balance');
    expect(balance.detail).toContain('Step 1');

    const pay = describeOnboardingFailure(
      refused(400, zodBody([{code: 'too_small', message: 'Number must be >= 0', path: ['pay']}])),
    );
    expect(pay.headline).toBe('Check your paycheck');
    expect(pay.detail).toContain('Step 2');
  });

  it('names an answer Clerk supplies without inventing a step for it', () => {
    const {headline, detail} = describeOnboardingFailure(
      refused(
        400,
        zodBody([
          {
            code: 'too_big',
            message: 'String must contain at most 120 character(s)',
            path: ['name'],
          },
        ]),
      ),
    );
    expect(headline).toBe('Check your name');
    expect(detail).toContain('Your name was refused');
    // There is no step to send them back to, so the copy must not invent one.
    expect(detail).not.toContain('Step');
    expect(detail).not.toContain('go back');
  });

  it('names the first refusal and says how many others there were', () => {
    const {headline, detail} = describeOnboardingFailure(
      refused(
        400,
        zodBody([
          {
            code: 'too_big',
            message: 'Number must be less than or equal to 99',
            path: ['cards', 0, 'apr'],
          },
          {
            code: 'too_small',
            message: 'Number must be greater than 0',
            path: ['cards', 1, 'limit'],
          },
          {
            code: 'too_small',
            message: 'String must contain at least 1 character(s)',
            path: ['bills', 0, 'name'],
          },
        ]),
      ),
    );
    expect(headline).toBe("Check card 1's APR");
    expect(detail).toContain('2 other answers came back refused too.');
    expect(detail).not.toContain('limit');
  });

  it('says "1 other answer" rather than "1 other answers"', () => {
    const {detail} = describeOnboardingFailure(
      refused(
        400,
        zodBody([
          {code: 'custom', message: 'That day has already passed.', path: ['nextPay']},
          {code: 'too_small', message: 'Number must be >= 0', path: ['balance']},
        ]),
      ),
    );
    expect(detail).toContain('1 other answer came back refused too.');
  });

  it('treats a 422 as the same refusal a 400 is', () => {
    const {headline} = describeOnboardingFailure(
      refused(422, zodBody([{code: 'custom', message: 'Nope', path: ['cats', 0, 'budget']}])),
    );
    expect(headline).toBe("Check category 1's budget");
  });

  it('falls back rather than throwing when a 400 body is not JSON', () => {
    const {headline, detail} = describeOnboardingFailure(refused(400, 'Bad Request'));
    expect(headline).toBe('The Runway API refused the setup');
    expect(detail).toContain('400');
    expect(detail).not.toContain('Bad Request');
  });

  it('falls back when the JSON carries no issues to read', () => {
    for (const body of [
      JSON.stringify({error: 'Unauthorized'}),
      JSON.stringify({success: false, error: {issues: [], name: 'ZodError'}}),
      JSON.stringify({
        success: false,
        error: {issues: [{code: 'custom', message: 'Nope', path: []}]},
      }),
      JSON.stringify(null),
      '',
      undefined,
    ]) {
      const {headline} = describeOnboardingFailure(refused(400, body));
      expect(headline).toBe('The Runway API refused the setup');
    }
  });

  it('still produces a usable sentence for a path root it has never heard of', () => {
    const {headline, detail} = describeOnboardingFailure(
      refused(400, zodBody([{code: 'custom', message: 'Nope', path: ['goals', 0, 'target']}])),
    );
    expect(headline).toContain('goals');
    expect(detail).toContain('“Nope”');
    expect(detail).toContain('Show me my number again');
  });

  it('does not mistake an inherited property for an answer it knows', () => {
    // The label maps are plain object literals, so a path root named after
    // anything on `Object.prototype` answers with a function unless the lookup
    // checks. Before it did, this rendered "Check undefined".
    for (const root of ['toString', 'constructor', 'hasOwnProperty']) {
      const {headline, detail} = describeOnboardingFailure(
        refused(400, zodBody([{code: 'custom', message: 'Nope', path: [root, 0, 'toString']}])),
      );
      expect(headline).toContain(root);
      expect(`${headline} ${detail}`).not.toContain('undefined');
      expect(`${headline} ${detail}`).not.toContain('function');
    }
  });

  it('tells a refused session to sign in elsewhere, never to reload', () => {
    for (const status of [401, 403]) {
      const {headline, detail} = describeOnboardingFailure(
        refused(status, '{"error":"Unauthorized"}'),
      );
      expect(headline).toBe('Your sign-in has expired');
      expect(detail).toContain(String(status));
      expect(detail).toContain('another tab');
      expect(detail).toContain('reloading would lose it');
    }
  });

  it('blames the server for a 5xx rather than the answers', () => {
    for (const status of [500, 503]) {
      const {headline, detail} = describeOnboardingFailure(
        refused(status, 'Internal Server Error'),
      );
      expect(headline).toBe('The Runway API broke');
      expect(detail).toContain(String(status));
      expect(detail).not.toContain('Internal Server Error');
    }
  });

  it('separates a call that never landed from one that was refused', () => {
    for (const error of [new ApiError('no-response', PATH), new TypeError('Failed to fetch')]) {
      const {headline} = describeOnboardingFailure(error);
      expect(headline).toBe('Nothing came back from the Runway API');
    }
  });

  it('falls back to the console without pretending to know why', () => {
    for (const error of [undefined, new Error('boom')]) {
      const {headline, detail} = describeOnboardingFailure(error);
      expect(headline).toBe("That didn't go through");
      expect(detail).toContain('console');
    }
  });

  it('promises the answers survived, whatever failed', () => {
    const cases: unknown[] = [
      refused(400, zodBody([{code: 'custom', message: 'Nope', path: ['nextPay']}])),
      refused(401),
      refused(500),
      refused(404),
      new ApiError('no-response', PATH),
      undefined,
    ];
    for (const error of cases) {
      const {detail} = describeOnboardingFailure(error);
      expect(detail).toContain('still on this page');
      expect(detail).toContain('Show me my number');
    }
  });
});
