import {daysUntil} from './cycles';
import {fm} from './money';
import type {Bill, Card, CardReward} from './types';

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

/** Reward-pill palette by category keyword (catalog §4.1). */
export function rewardPillColors(cat: string): {bg: string; fg: string} {
  const c = cat.toLowerCase();
  if (/grocer|supermarket|whole foods|costco run/.test(c)) return {bg: '#e3eedd', fg: '#2e5c38'};
  if (/gas|fuel/.test(c)) return {bg: '#f4e3cf', fg: '#8a5a1e'};
  if (/restaurant|dining|food/.test(c)) return {bg: '#f6ded7', fg: '#9c4326'};
  if (/travel|miles|hotel|flight/.test(c)) return {bg: '#dce7ee', fg: '#2f5a74'};
  if (/stream|apple|amazon|online|drugstore/.test(c)) return {bg: '#e7deef', fg: '#5b4176'};
  if (/rotating|quarter|top category/.test(c)) return {bg: '#f2e8cc', fg: '#77621f'};
  return {bg: '#eee7d9', fg: '#5c5142'};
}

function monthYear(date: Date): string {
  return date.toLocaleDateString('en-US', {month: 'short', year: 'numeric'});
}

/** The five status-line variants (catalog §3.7), exact copy. */
export function cardLine(
  c: Card,
  paymentBill: Bill | undefined,
  today: Date,
): {text: string; color: string} {
  if (c.balance <= 0) {
    return {text: `Paid off — ${fm(c.limit)} available`, color: '#2e7d4f'};
  }
  if (c.payInFull) {
    if (paymentBill) {
      const due = new Date(paymentBill.dueDate + 'T00:00:00');
      const dueLabel = due.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
      return {
        text: `Pays in full ${dueLabel} — ${fm(c.balance)}, $0 interest`,
        color: '#2e7d4f',
      };
    }
    return {
      text: 'Pays in full — add a due day so it lands on your runway',
      color: '#c2410c',
    };
  }
  if (c.promoRate != null && c.promoEnd && daysUntil(c.promoEnd, today) > 0) {
    const daysLeft = daysUntil(c.promoEnd, today);
    const months = Math.max(1, Math.round(daysLeft / 30));
    const end = new Date(c.promoEnd + 'T00:00:00');
    return {
      text: `⏳ ${c.promoRate}% ends ${monthYear(end)} (${months} mo) — clear ${fm(c.balance)} by then or it costs ${c.apr}%`,
      color: daysLeft < 90 ? '#c2410c' : '#5c5142',
    };
  }
  if (paymentBill) {
    const projection = payoffProjection(c, paymentBill.amount);
    if (!projection) {
      return {
        text: `${fm(paymentBill.amount)}/mo doesn't cover the interest — raise the payment`,
        color: '#c2410c',
      };
    }
    const clearDate = new Date(today.getFullYear(), today.getMonth() + projection.months, 1);
    return {
      text: `At ${fm(paymentBill.amount)}/mo → clear by ${monthYear(clearDate)} · ≈${fm(projection.interest)} interest on the way`,
      color: '#5c5142',
    };
  }
  const monthlyInterest = Math.max(1, Math.round((c.balance * c.apr) / 1200));
  return {
    text: `No due date set — Edit to add one · interest ≈ ${fm(monthlyInterest)}/mo at ${c.apr}%`,
    color: '#5c5142',
  };
}
