/**
 * Settings wrote the next payday on every `change`, so a date typed rather than
 * picked was PATCHed while still half-entered: typing the year `2027` sent
 * `0002-08-19`, the response replaced the cached state, and the controlled
 * input blanked mid-edit because `0002-08-19` is not a displayable date (#147).
 * Nothing bounded it either — `profilePatchSchema.nextPay` is a bare nullable
 * ISO date, and a `nextPay`-only PATCH carries no cadence to check it against,
 * so a biweekly earner could store a payday five months out and be told nothing.
 *
 * Committing on blur makes one edit one decision, and that decision has more
 * outcomes than "a date": an untouched field and a re-picked identical date
 * both mean send nothing, an emptied field is a deliberate `null`, and a date
 * that cannot be a next payday has to be refused with the reason on screen.
 * Returning a union is what stops the caller having to guess which it holds.
 */

import {nextPayProblem, type Cadence} from '@runway/shared';

export type PaydayCommit =
  | {status: 'unchanged'}
  | {status: 'invalid'; message: string}
  | {status: 'write'; value: string | null};

/**
 * What committing the next-payday field means, given what is already stored.
 *
 * `today` is a parameter rather than a `new Date()` in here because the caller
 * already holds one for the field's `min`/`max` — one clock read per render,
 * and refusals a test can pin a date against.
 */
export function commitPayday(
  draft: string | null,
  stored: string | null,
  cadence: Cadence,
  today: Date,
): PaydayCommit {
  // Never edited: focusing a field and leaving is not a request to store anything.
  if (draft === null) return {status: 'unchanged'};
  // An empty field and a stored `null` are the same state, so neither re-picking
  // the date on file nor re-clearing an already-clear field sends a PATCH.
  if (draft === (stored ?? '')) return {status: 'unchanged'};
  // Clearing is legitimate: the profile carries no payday until one is set.
  if (draft === '') return {status: 'write', value: null};

  const problem = nextPayProblem(draft, cadence, today);
  if (problem !== null) return {status: 'invalid', message: problem};

  return {status: 'write', value: draft};
}
