import {daysUntil} from './cycles';
import {round2} from './goals';
import type {Card, CardReward} from './types';

/** Effective APR — promo rate while the promo is still live (catalog §3.7). */
export function effectiveApr(c: Card, today: Date): number {
  if (c.promoRate != null && c.promoEnd && daysUntil(c.promoEnd, today) > 0) {
    return c.promoRate;
  }
  return c.apr;
}

/**
 * Amortization: months to clear the balance at a fixed monthly payment and the
 * total interest on the way. Null when the payment doesn't cover interest.
 */
export function payoffProjection(
  c: Card,
  monthlyPayment: number,
): {months: number; interest: number} | null {
  const r = c.apr / 1200;
  const balance = c.balance;
  if (monthlyPayment <= balance * r) return null;
  const months = Math.ceil(-Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r));
  const interest = Math.max(0, Math.round(monthlyPayment * months - balance));
  return {months, interest};
}

/** Design's minimum-payment pencil-in: 3% with a $25 floor. */
export function minPaymentGuess(balance: number): number {
  return Math.max(25, Math.ceil(balance * 0.03));
}

type UsageFields = Pick<Card, 'balance' | 'limit'>;

/**
 * How full a card's usage bar is, and whether it has crossed the four-fifths
 * mark the tile warns at. The limit is typed in by hand and can be zero, which
 * makes the share `Infinity` on a card carrying anything and `NaN` on an empty
 * one — and a `NaN` width is dropped by the CSSOM silently rather than refused
 * loudly, so the bar reads as untouched. A card with no limit recorded has
 * used all of what it has the moment it carries a balance.
 */
export function cardUsage(c: UsageFields): {pct: number; overEighty: boolean} {
  if (c.limit <= 0) return {pct: c.balance > 0 ? 100 : 0, overEighty: c.balance > 0};
  return {
    pct: Math.min(100, (c.balance / c.limit) * 100),
    overEighty: c.balance / c.limit >= 0.8,
  };
}

type PlanFields = Pick<Card, 'balance' | 'planInstallment' | 'planMonthsLeft'>;

/** Everything the payment rules read off a card, as plain numbers. */
export type CardPaymentFields = PlanFields & Pick<Card, 'payInFull' | 'minPay'>;

/**
 * The term-plan principal still outstanding on a card: what is left to pay,
 * capped by the balance carrying it. A statement correction can shrink the
 * balance out from under a plan, and a plan can never exceed what is owed.
 */
export function planPrincipal(c: PlanFields): number {
  const left = Math.max(0, Math.floor(c.planMonthsLeft));
  const per = Math.max(0, c.planInstallment);
  return round2(Math.min(left * per, Math.max(0, c.balance)));
}

/**
 * What the card's own repayment rule asks for this month on the part of the
 * balance that is not term-plan principal. Split out of `cardPaymentDue` so
 * that writing a bill and reading a payment back use the same figure.
 */
function revolvingDue(c: CardPaymentFields, plan: number): number {
  const revolving = round2(Math.max(0, c.balance) - plan);
  if (revolving <= 0) return 0;
  if (c.payInFull) return revolving;
  return c.minPay != null ? c.minPay : minPaymentGuess(revolving);
}

/**
 * What a card asks for on its next due day: one installment of any term plan,
 * plus whatever repayment rule the card carries applied to the rest.
 *
 * `payInFull` describes how someone clears their statement, and it is right
 * for ordinary spending. It is wrong for a plan: choosing a term is precisely
 * a statement that the principal is not due at once (#20). Splitting the
 * balance keeps both halves honest on the same card.
 */
export function cardPaymentDue(
  c: CardPaymentFields,
  /** What the existing bill asks for, when nothing else determines it. */
  fallback: number | null,
): number {
  const plan = planPrincipal(c);

  if (plan > 0) {
    const installment = Math.min(plan, Math.max(0, c.planInstallment));
    // No `fallback` branch while a plan runs: the existing bill amount
    // already contains an installment, and reusing it would stack a second
    // one on top at every sync.
    return round2(installment + revolvingDue(c, plan));
  }

  return c.payInFull
    ? c.balance
    : c.minPay != null
      ? c.minPay
      : fallback != null
        ? fallback
        : minPaymentGuess(c.balance);
}

/** Money in whole cents, so `floor` cannot lose a month to binary rounding. */
function cents(n: number): number {
  return Math.round(round2(n) * 100);
}

export interface CardPaymentSplit {
  /** The part the card's ordinary rule claimed this month. */
  revolvingPaid: number;
  /** The part that landed on term-plan principal. */
  planPaid: number;
  /** Whole installments that principal cleared, capped by the term left. */
  installments: number;
}

/**
 * How a payment divides between a card's term plan and everything else.
 *
 * A card carrying a plan asks for `installment + revolvingDue` on its due day,
 * so a payment has to be read back the same way round: the card's ordinary
 * rule is served first, and only what is left over is plan principal.
 * Dividing the whole payment by the installment counts the revolving minimum
 * as principal and retires months nobody paid for (#102).
 *
 * The mirrored bill needs no special case. Feed this `cardPaymentDue(c, …)`
 * and the revolving part cancels exactly, leaving one installment — one month,
 * which is precisely what that bill contained.
 */
export function cardPaymentSplit(c: CardPaymentFields, amount: number): CardPaymentSplit {
  const paid = Math.max(0, round2(amount));
  const plan = planPrincipal(c);
  // The same figure `cardPaymentDue` bills: `planInstallment` in an ordinary
  // month, and whatever principal is left in the short final one. Dividing by
  // the raw installment would settle nothing in that last month, because the
  // bill is smaller than a full installment by then.
  const installment = Math.min(plan, Math.max(0, c.planInstallment));
  if (installment <= 0) return {revolvingPaid: paid, planPaid: 0, installments: 0};

  const revolvingPaid = Math.min(paid, revolvingDue(c, plan));
  const planPaid = round2(paid - revolvingPaid);
  const months = Math.floor(cents(planPaid) / cents(installment));
  return {
    revolvingPaid,
    planPaid,
    installments: Math.min(Math.max(0, Math.floor(c.planMonthsLeft)), months),
  };
}

interface RewardRule {
  pattern: RegExp;
  rewards: CardReward[];
}

const REWARD_RULES: RewardRule[] = [
  {
    pattern: /freedom unlimited/i,
    rewards: [
      {rate: '1.5%', cat: 'everything else'},
      {rate: '3%', cat: 'dining'},
      {rate: '3%', cat: 'drugstores'},
    ],
  },
  {
    pattern: /quicksilver|unlimited cash/i,
    rewards: [{rate: '1.5%', cat: 'everything'}],
  },
  {
    pattern: /freedom flex|discover it/i,
    rewards: [
      {rate: '5%', cat: 'rotating categories'},
      {rate: '1%', cat: 'everything else'},
    ],
  },
  {
    pattern: /blue cash preferred/i,
    rewards: [
      {rate: '6%', cat: 'groceries'},
      {rate: '6%', cat: 'streaming'},
      {rate: '3%', cat: 'gas'},
    ],
  },
  {
    pattern: /blue cash/i,
    rewards: [
      {rate: '3%', cat: 'groceries'},
      {rate: '3%', cat: 'streaming'},
      {rate: '3%', cat: 'gas'},
    ],
  },
  {
    pattern: /amex gold|american express gold/i,
    rewards: [
      {rate: '4x', cat: 'restaurants'},
      {rate: '4x', cat: 'groceries'},
      {rate: '3x', cat: 'flights'},
    ],
  },
  {
    pattern: /sapphire/i,
    rewards: [
      {rate: '3x', cat: 'dining'},
      {rate: '2x', cat: 'travel'},
    ],
  },
  {
    pattern: /custom cash/i,
    rewards: [
      {rate: '5%', cat: 'top category'},
      {rate: '1%', cat: 'everything else'},
    ],
  },
  {
    pattern: /double cash|active cash/i,
    rewards: [{rate: '2%', cat: 'everything'}],
  },
  {
    pattern: /venture/i,
    rewards: [
      {rate: '2x', cat: 'travel'},
      {rate: '2x', cat: 'everything else'},
    ],
  },
  {
    pattern: /costco/i,
    rewards: [
      {rate: '4%', cat: 'gas'},
      {rate: '3%', cat: 'restaurants'},
      {rate: '2%', cat: 'Costco runs'},
    ],
  },
  {
    pattern: /amazon|prime/i,
    rewards: [
      {rate: '5%', cat: 'Amazon'},
      {rate: '5%', cat: 'Whole Foods'},
      {rate: '2%', cat: 'gas'},
    ],
  },
  {
    pattern: /apple/i,
    rewards: [
      {rate: '3%', cat: 'Apple'},
      {rate: '2%', cat: 'Apple Pay'},
    ],
  },
];

/** Guess reward pills from a card nickname (catalog §3.7). */
export function suggestRewards(name: string): CardReward[] {
  for (const rule of REWARD_RULES) {
    if (rule.pattern.test(name)) return rule.rewards;
  }
  return [];
}
