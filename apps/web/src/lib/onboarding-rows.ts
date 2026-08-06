/**
 * Onboarding's bill row and card row each add themselves through one function
 * that parsed, judged and wrote state in a single breath, and whose entire
 * failure mode was a bare `return`. A row missing its amount simply did not
 * appear: nothing moved, nothing was said, and a screen reader had nothing to
 * read out, because there was no state holding a reason and no element to put
 * one in (#58).
 *
 * Separating the judgement from the write is what makes the refusal sayable.
 * The caller gets back *which* field is at fault, not merely that something
 * is, so the message can be tied to the input the user has to go and fix.
 *
 * The rules are the ones `onboardingCompleteSchema` applies anyway — a
 * non-empty name of at most 120 characters, a strictly positive amount and
 * limit. Checking them at the row is not duplication for its own sake: the
 * submit is the last step of the flow, and a row rejected there is rejected
 * long after the user stopped thinking about it.
 */

import {parseMoneyInput} from './money-input';

export type RowField = 'name' | 'amount' | 'limit';

export interface RowProblem {
  field: RowField;
  message: string;
}

/**
 * `onboardingCompleteSchema` bounds every bill and card name at 120
 * characters, so a longer one is a submit that fails at the end of the flow.
 */
const NAME_MAX = 120;

/**
 * The money fields go through `parseMoneyInput` rather than `parseFloat`,
 * which reads a valid prefix and throws the rest away: `1.2.3` typed into the
 * amount was becoming a $1.20 bill nobody asked for.
 */
function moneyProblem(
  field: 'amount' | 'limit',
  raw: string,
  blankMessage: string,
): RowProblem | null {
  const parsed = parseMoneyInput(raw);
  if (parsed.status === 'blank') return {field, message: blankMessage};
  if (parsed.status === 'invalid')
    return {field, message: `Check the ${field} — ${parsed.message}.`};
  if (parsed.value <= 0) return {field, message: `That ${field} has to be more than $0.`};
  return null;
}

/** Why a name typed into either row cannot be used, or `null` when it can. */
function nameProblem(name: string, blankMessage: string, noun: string): RowProblem | null {
  const trimmed = name.trim();
  if (trimmed === '') return {field: 'name', message: blankMessage};
  if (trimmed.length > NAME_MAX) {
    return {
      field: 'name',
      message: `That ${noun} is too long — keep it to ${NAME_MAX} characters or fewer.`,
    };
  }
  return null;
}

/**
 * Why this bill row cannot be added, or `null` when it can.
 *
 * The name is judged before the amount — the row's own left-to-right order,
 * so the field being named is the first one the user has to go back to.
 */
export function billRowProblem(name: string, amountRaw: string): RowProblem | null {
  return (
    nameProblem(name, 'Give the bill a name — rent, electric, whatever you call it.', 'name') ??
    moneyProblem('amount', amountRaw, 'Give the bill an amount.')
  );
}

/**
 * Why this card row cannot be added, or `null` when it can.
 *
 * What the card owes is deliberately not judged. Zero is a real balance and so
 * is one above the limit; refusing an over-limit card would make a card
 * somebody actually holds impossible to record during setup.
 */
export function cardRowProblem(name: string, limitRaw: string): RowProblem | null {
  return (
    nameProblem(name, 'Give the card a nickname so you can tell your cards apart.', 'nickname') ??
    moneyProblem('limit', limitRaw, 'Give the card a limit.')
  );
}
