/**
 * Onboarding's APR field read whatever `parseFloat` returned and compared it to
 * nothing, while the API caps `cards[].apr` at the bound `cardUpsertSchema`
 * declares. A card entered at 199% was listed back as accepted and only refused
 * by `POST /onboarding/complete` five steps later, as a 400 the wizard never
 * shows (#59). The point of entry is the only place the user can still connect
 * the refusal to the field that caused it.
 *
 * The bound is read back out of the schema rather than restated here, so the
 * sentence the user is shown cannot drift from the rule the request is judged
 * by.
 */

import {cardUpsertSchema} from '@runway/shared';
import {parseMoneyInput} from './money-input';

export type AprInput = {status: 'ok'; value: number} | {status: 'invalid'; message: string};

/**
 * What the user has typed into an APR field, as the form should treat it.
 *
 * Blank is `0` rather than a refusal: an unfilled APR already meant zero, and
 * the step's own copy invites rough numbers, so nothing that used to add a card
 * stops adding one. The digits go through `parseMoneyInput` rather than
 * `parseFloat`, which keeps the longest valid prefix and throws the rest away —
 * a bound checked on top of that would be a bound on `1.2` for someone who
 * typed `1.2.3`.
 */
export function parseAprInput(raw: string): AprInput {
  const parsed = parseMoneyInput(raw);
  if (parsed.status === 'blank') return {status: 'ok', value: 0};
  // money-input's refusals are lowercase fragments written for the settings
  // rows; this one is a sentence because it lands in step 4's helper line,
  // alongside step 2's.
  if (parsed.status === 'invalid') return {status: 'invalid', message: 'That is not a number.'};

  const bounded = cardUpsertSchema.shape.apr.safeParse(parsed.value);
  if (bounded.success) return {status: 'ok', value: bounded.data};

  const issue = bounded.error.issues[0];
  if (issue.code === 'too_big') {
    return {
      status: 'invalid',
      message: `That is above the highest APR we can store — the most is ${issue.maximum}%.`,
    };
  }
  if (issue.code === 'too_small') {
    return {
      status: 'invalid',
      message: `That is below the lowest APR we can store — the least is ${issue.minimum}%.`,
    };
  }
  // Unreachable today: the value is already a finite number by here, so the two
  // bounds are the only rules left for it to break. Still a refusal, because a
  // rule this does not recognise is one the request would fail on.
  return {status: 'invalid', message: 'That is not an APR we can store.'};
}
