/**
 * Onboarding's first two steps asked `parseFloat` to be both parser and
 * validator for the balance and the paycheck. It is neither: it reads the
 * longest valid numeric prefix and throws the rest away, and the field's own
 * keystroke filter permits a second `.`, so `1.2.3` was typeable and quietly
 * became 1.2. The Next gates read that truncated number — `balance >= 0` and
 * `pay > 0` — so the flow advanced without a word, and setup finished storing
 * a $1.20 balance nobody typed (#57).
 *
 * Judging is a separate pure module rather than a check inside the component
 * because the component cannot be tested here: `apps/web` has no jsdom and
 * `vitest.config.ts` collects only the `.test.ts` files under `test/` (#69).
 * A pure judge is the part that can carry a regression test, which is the
 * same trade `lib/money-input.ts` already makes.
 *
 * The rules are the ones the gates and `onboardingCompleteSchema` already
 * apply — both fields are `money.nonnegative()`, and step 2 has always
 * required a paycheck above zero. Nothing new is refused here; the refusals
 * that were already happening are merely made sayable.
 */

import {parseMoneyInput} from './money-input';

/**
 * Blank is deliberately not a problem: an untouched field is a form the user
 * has not filled in yet, and it has no message because there is nothing to
 * tell them off about.
 */
export type OnboardingAmount =
  {status: 'blank'} | {status: 'problem'; message: string} | {status: 'ok'; value: number};

/**
 * `allowNegative: false` on both fields, matching `money.nonnegative()` on the
 * schema. The input filter strips `-` anyway, so this is the belt to that
 * suspenders — and it is `parseMoneyInput`'s own reason that gets quoted, so
 * "that number is too big" and "that can't be negative" come through too
 * rather than being flattened into one generic complaint.
 */
function judge(field: 'balance' | 'paycheck', raw: string): OnboardingAmount {
  const parsed = parseMoneyInput(raw, {allowNegative: false});
  if (parsed.status === 'blank') return {status: 'blank'};
  if (parsed.status === 'invalid') {
    return {status: 'problem', message: `Check the ${field} — ${parsed.message}.`};
  }
  return {status: 'ok', value: parsed.value};
}

/**
 * What the user left in step 1's balance field.
 *
 * Zero is accepted. An empty account is a real thing to be told about, and it
 * is what makes the safe-to-spend number worth reading.
 */
export function onboardingBalance(raw: string): OnboardingAmount {
  return judge('balance', raw);
}

/**
 * What the user left in step 2's paycheck field.
 *
 * Zero is a problem here and only here: the step's Next gate has always been
 * `pay > 0`, and this fix must not change what is accepted, only make the
 * refusal sayable.
 */
export function onboardingPaycheck(raw: string): OnboardingAmount {
  const judged = judge('paycheck', raw);
  if (judged.status === 'ok' && judged.value <= 0) {
    return {status: 'problem', message: 'That paycheck has to be more than $0.'};
  }
  return judged;
}
