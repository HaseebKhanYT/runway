import {daysUntil} from './cycles';
import type {Card, CardReward} from './types';

/** Effective APR — promo rate while the promo is still live (catalog §3.7). */
export function effApr(c: Card, today: Date): number {
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
