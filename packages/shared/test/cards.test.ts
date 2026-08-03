import {describe, expect, it} from 'vitest';
import {
  cardPaymentDue,
  effectiveApr,
  minPaymentGuess,
  payoffProjection,
  planPrincipal,
  suggestRewards,
} from '../src/cards';
import {round2} from '../src/goals';
import type {Card} from '../src/types';

const TODAY = new Date('2026-07-16T12:00:00');

function makeCard(partial: Partial<Card>): Card {
  return {
    id: 'c1',
    name: 'Card A',
    apr: 17.9,
    limit: 3500,
    balance: 1240,
    dueDay: null,
    minPay: null,
    payInFull: false,
    planInstallment: 0,
    planMonthsLeft: 0,
    rewards: [],
    promoRate: null,
    promoEnd: null,
    balanceUpdatedAt: '2026-07-16T00:00:00.000Z',
    ...partial,
  };
}

describe('effectiveApr', () => {
  it('uses promo rate while the promo is live', () => {
    expect(effectiveApr(makeCard({promoRate: 0, promoEnd: '2026-12-03'}), TODAY)).toBe(0);
  });
  it('falls back to real APR when promo expired or absent', () => {
    expect(effectiveApr(makeCard({promoRate: 0, promoEnd: '2026-07-01'}), TODAY)).toBe(17.9);
    expect(effectiveApr(makeCard({}), TODAY)).toBe(17.9);
  });
});

describe('payoffProjection', () => {
  it('computes months and interest for a covering payment', () => {
    const p = payoffProjection(makeCard({}), 160);
    // r=17.9/1200; months = ceil(-ln(1-r*1240/160)/ln(1+r)) = 9
    expect(p).toEqual({months: 9, interest: Math.max(0, Math.round(160 * 9 - 1240))});
  });
  it('returns null when the payment cannot cover interest', () => {
    expect(payoffProjection(makeCard({}), 5)).toBeNull();
  });
});

describe('minPaymentGuess', () => {
  it('is 3% with a $25 floor', () => {
    expect(minPaymentGuess(1240)).toBe(38);
    expect(minPaymentGuess(100)).toBe(25);
  });
});

describe('suggestRewards', () => {
  it('matches known card names', () => {
    expect(suggestRewards('Amex Gold')).toEqual([
      {rate: '4x', cat: 'restaurants'},
      {rate: '4x', cat: 'groceries'},
      {rate: '3x', cat: 'flights'},
    ]);
    expect(suggestRewards('Chase Freedom Unlimited')).toEqual([
      {rate: '1.5%', cat: 'everything else'},
      {rate: '3%', cat: 'dining'},
      {rate: '3%', cat: 'drugstores'},
    ]);
    expect(suggestRewards('Some Credit Union Card')).toEqual([]);
  });
});

describe('planPrincipal', () => {
  it('is the installments still owed', () => {
    expect(planPrincipal(makeCard({balance: 8000, planInstallment: 667, planMonthsLeft: 12}))).toBe(
      8000,
    );
    expect(planPrincipal(makeCard({balance: 8000, planInstallment: 667, planMonthsLeft: 6}))).toBe(
      4002,
    );
  });

  it('never exceeds the balance carrying it', () => {
    // A statement correction can shrink the balance out from under a plan.
    expect(planPrincipal(makeCard({balance: 500, planInstallment: 667, planMonthsLeft: 12}))).toBe(
      500,
    );
  });

  it('is zero once the term is served', () => {
    expect(planPrincipal(makeCard({balance: 300, planInstallment: 667, planMonthsLeft: 0}))).toBe(
      0,
    );
  });
});

describe('cardPaymentDue', () => {
  it('bills one installment of a plan, not the whole principal', () => {
    // The #16/#20 scenario: $8,000 financed over 12 months onto a pay-in-full
    // card. Paying in full is how this user clears ordinary spending; it must
    // not demand a plan they were told would run for a year.
    const card = makeCard({
      balance: 8000,
      payInFull: true,
      planInstallment: 667,
      planMonthsLeft: 12,
    });
    expect(cardPaymentDue(card, null)).toBe(667);
  });

  it('adds the revolving rule on top of the installment', () => {
    // $8,000 of plan plus $500 of ordinary spending on a pay-in-full card:
    // the spending is cleared this month, the plan is not.
    //
    // Installments round up, so twelve of them come to $8,004 and the plan
    // claims $4 of the $500. That shortens the revolving part to $496 in the
    // first month only — the final installment is capped by whatever balance
    // is left, so the term still collects the principal exactly. See the
    // "collects exactly the balance over the term" case below.
    const payInFull = makeCard({
      balance: 8500,
      payInFull: true,
      planInstallment: 667,
      planMonthsLeft: 12,
    });
    expect(cardPaymentDue(payInFull, null)).toBe(1163);

    // With a stated minimum instead, the minimum covers the revolving part.
    const withMin = makeCard({
      balance: 8500,
      minPay: 160,
      planInstallment: 667,
      planMonthsLeft: 12,
    });
    expect(cardPaymentDue(withMin, null)).toBe(827);

    // With neither, the 3%-with-a-$25-floor guess applies to the revolving
    // $496 alone, which lands on the floor.
    const guessed = makeCard({balance: 8500, planInstallment: 667, planMonthsLeft: 12});
    expect(cardPaymentDue(guessed, null)).toBe(692);
  });

  it('collects exactly the balance over the term', () => {
    // Walk the whole plan: rounding pushes $4 of revolving into month one and
    // the last installment gives it back, so the twelve bills sum to the debt.
    let balance = 8500;
    let monthsLeft = 12;
    let collected = 0;
    while (monthsLeft > 0) {
      const due = cardPaymentDue(
        makeCard({balance, payInFull: true, planInstallment: 667, planMonthsLeft: monthsLeft}),
        null,
      );
      collected += due;
      balance = round2(balance - due);
      monthsLeft -= 1;
    }
    expect(collected).toBe(8500);
    expect(balance).toBe(0);
  });

  it('ignores the existing bill amount while a plan runs', () => {
    // Reusing it would stack a second installment on at every sync.
    const card = makeCard({balance: 8000, planInstallment: 667, planMonthsLeft: 12});
    expect(cardPaymentDue(card, 667)).toBe(cardPaymentDue(card, null));
  });

  it('never asks for more plan than is left', () => {
    const last = makeCard({balance: 400, planInstallment: 667, planMonthsLeft: 1});
    expect(cardPaymentDue(last, null)).toBe(400);
  });

  it('leaves a card with no plan exactly as it was', () => {
    expect(cardPaymentDue(makeCard({balance: 1240, payInFull: true}), null)).toBe(1240);
    expect(cardPaymentDue(makeCard({balance: 1240, minPay: 160}), null)).toBe(160);
    expect(cardPaymentDue(makeCard({balance: 1240}), 95)).toBe(95);
    expect(cardPaymentDue(makeCard({balance: 1240}), null)).toBe(38);
  });
});
