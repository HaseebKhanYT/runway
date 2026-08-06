import {cardUpsertSchema, type CardReward} from '@runway/shared';

export interface CardForm {
  cardId: string | null;
  name: string;
  aprRaw: string;
  limitRaw: string;
  balanceRaw: string;
  dueRaw: string;
  minPayRaw: string;
  payInFull: boolean;
  rewards: CardReward[];
  rewardRateRaw: string;
  rewardCatRaw: string;
  promoOn: boolean;
  promoAprRaw: string;
  promoMonthsRaw: string;
}

/**
 * A field a refusal can be shown against. `form` is the catch-all for a schema
 * issue on a path with no copy of its own — an unusable payload still has to
 * block the button, so nothing may fall through to a silent 400.
 */
export type CardFormField =
  'name' | 'apr' | 'limit' | 'balance' | 'dueDay' | 'minPay' | 'promoRate' | 'promoMonths' | 'form';

const problemCopy: Record<CardFormField, string> = {
  name: 'Nicknames stop at 120 characters.',
  apr: 'APR runs from 0 to 99%.',
  limit: 'That’s not a number.',
  balance: 'That’s not a number.',
  dueDay: 'Pick a day from 1 to 31.',
  minPay: '$0 isn’t a payment — leave it blank and we’ll pencil in a minimum.',
  promoRate: 'A promo APR runs from 0 to 99%.',
  promoMonths: 'A promo runs 1 to 60 months.',
  form: 'Something in here is outside what we can save.',
};

/** The body the cards page POSTs to `/cards` and PATCHes to `/cards/:id`. */
export function cardPayload(f: CardForm): unknown {
  return {
    name: f.name.trim(),
    apr: parseFloat(f.aprRaw) || 0,
    limit: parseFloat(f.limitRaw) || 0,
    balance: parseFloat(f.balanceRaw) || 0,
    dueDay: f.dueRaw ? Math.min(31, Math.max(1, parseInt(f.dueRaw, 10))) : null,
    minPay: f.payInFull ? null : f.minPayRaw ? parseFloat(f.minPayRaw) : null,
    payInFull: f.payInFull,
    rewards: f.rewards,
    promoRate: f.promoOn ? parseFloat(f.promoAprRaw) || 0 : null,
    promoMonths: f.promoOn && f.promoMonthsRaw ? parseInt(f.promoMonthsRaw, 10) : null,
  };
}

/**
 * True while the form is still missing what it cannot be submitted without.
 * A card needs a nickname and a limit above zero; everything else has a
 * defensible default. Missing is not the same as refused — a half-typed form
 * is not an error, so this only disables the button and says nothing.
 */
export function cardFormIncomplete(f: CardForm): boolean {
  return !f.name.trim() || !(parseFloat(f.limitRaw) > 0);
}

function fieldFor(path: string | number | undefined): CardFormField {
  return typeof path === 'string' && path in problemCopy ? (path as CardFormField) : 'form';
}

/**
 * Per-field refusals, derived from `cardUpsertSchema` rather than restated —
 * the bounds the server enforces are the bounds the form shows, and they can
 * only ever be one set.
 *
 * The parse runs on the payload object, before `JSON.stringify` sees it. That
 * ordering is the point: serialisation turns a `NaN` minimum payment (a lone
 * `.` in the box) into `null`, so the server is handed a card whose payment
 * has quietly been erased and answers 200. Only a check on this side of the
 * wire can catch it.
 */
export function cardFormProblems(f: CardForm): Partial<Record<CardFormField, string>> {
  const parsed = cardUpsertSchema.safeParse(cardPayload(f));
  if (parsed.success) return {};

  const incomplete = cardFormIncomplete(f);
  const problems: Partial<Record<CardFormField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = fieldFor(issue.path[0]);
    // An empty nickname or limit is the form being unfinished, not wrong.
    if (incomplete && (field === 'name' || field === 'limit')) continue;
    problems[field] = problemCopy[field];
  }
  return problems;
}
