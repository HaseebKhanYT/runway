/**
 * Settings commits its money fields on blur, so there is no submit button at
 * which the user affirms what they typed. `parseFloat(raw) || 0` collapsed the
 * three states a field can be left in — cleared, unparseable, and a deliberate
 * zero — into one silent write of `0`, which is how backspacing a balance to
 * empty and clicking away wiped it (#145).
 *
 * Telling the three apart is what lets a caller refuse the first two while
 * still storing the third, so the result is a union rather than a number.
 */

export type MoneyInput =
  {status: 'blank'} | {status: 'invalid'; message: string} | {status: 'ok'; value: number};

/**
 * Optional leading `-`, then digits with at most one `.` and at least one digit
 * somewhere. Anchored on purpose: `parseFloat` reads the longest valid prefix
 * and throws the rest away, so it turns `1-2` into 1 and `1.2.3` into 1.2.
 */
const MONEY = /^-?(?:\d+\.?\d*|\.\d+)$/;

/**
 * What the user left in a money field at commit time.
 *
 * `allowNegative` defaults to true because a checking balance can legitimately
 * be overdrawn; fields the API refuses negatives for (`payAmount`) pass false
 * and get their own message, so the user is told which rule they broke.
 */
export function parseMoneyInput(raw: string, opts: {allowNegative?: boolean} = {}): MoneyInput {
  const trimmed = raw.trim();
  if (trimmed === '') return {status: 'blank'};
  if (!MONEY.test(trimmed)) return {status: 'invalid', message: "that isn't a number"};

  const value = Number(trimmed);
  // Reachable: enough digits and `Number` returns Infinity rather than failing.
  if (!Number.isFinite(value)) return {status: 'invalid', message: 'that number is too big'};
  if (value < 0 && opts.allowNegative === false) {
    return {status: 'invalid', message: "that can't be negative"};
  }

  return {status: 'ok', value};
}
