import {describe, expect, it} from 'vitest';
import {
  cardPaymentDue,
  cardPaymentSplit,
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
  it('counts the promo end date itself as live', () => {
    expect(effectiveApr(makeCard({promoRate: 0, promoEnd: '2026-07-16'}), TODAY)).toBe(0);
    expect(effectiveApr(makeCard({promoRate: 0, promoEnd: '2026-07-17'}), TODAY)).toBe(0);
  });
  it('expires the day after the promo end date', () => {
    expect(effectiveApr(makeCard({promoRate: 0, promoEnd: '2026-07-15'}), TODAY)).toBe(17.9);
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

describe('cardPaymentSplit', () => {
  it('serves the revolving rule before the plan', () => {
    // The #102 divergence. This card's bill asks $350: one $100 installment
    // plus the $250 stated minimum on the $500 that is not plan principal.
    // Reading it back by dividing the whole payment by the installment —
    // floor(350/100) — retires three months for a payment that covered one.
    const card = makeCard({balance: 800, planInstallment: 100, planMonthsLeft: 3, minPay: 250});
    expect(cardPaymentDue(card, null)).toBe(350);
    expect(cardPaymentSplit(card, 350)).toEqual({
      revolvingPaid: 250,
      planPaid: 100,
      installments: 1,
    });
  });

  it("settles exactly one month when handed the card's own bill", () => {
    // The identity that makes the bill path need no special case: whatever
    // the revolving rule contributes cancels, leaving one installment. It has
    // to hold for every repayment rule and for the short final month.
    const cards = [
      makeCard({balance: 8500, payInFull: true, planInstallment: 667, planMonthsLeft: 12}),
      makeCard({balance: 8500, minPay: 160, planInstallment: 667, planMonthsLeft: 12}),
      makeCard({balance: 8500, planInstallment: 667, planMonthsLeft: 12}),
      makeCard({balance: 800, minPay: 250, planInstallment: 100, planMonthsLeft: 3}),
      makeCard({balance: 400, planInstallment: 667, planMonthsLeft: 1}),
    ];
    for (const card of cards) {
      expect(cardPaymentSplit(card, cardPaymentDue(card, null)).installments).toBe(1);
    }
  });

  it('settles a whole month for each installment paid up front', () => {
    const card = makeCard({balance: 800, planInstallment: 100, planMonthsLeft: 3, minPay: 250});
    // $250 of each payment is the revolving minimum; the rest is principal.
    expect(cardPaymentSplit(card, 450).installments).toBe(2);
    expect(cardPaymentSplit(card, 550).installments).toBe(3);
  });

  it('settles nothing when the payment does not clear an installment', () => {
    const card = makeCard({balance: 800, planInstallment: 100, planMonthsLeft: 3, minPay: 250});
    // Paying exactly the minimum leaves the plan untouched, and paying less
    // than the minimum must not reach it either.
    expect(cardPaymentSplit(card, 250).installments).toBe(0);
    expect(cardPaymentSplit(card, 100).installments).toBe(0);
  });

  it('divides by the figure actually billed in the short final month', () => {
    // The bill is $400 against a $667 installment, so dividing by the raw
    // installment would settle nothing for the payment that finished the plan.
    const last = makeCard({balance: 400, planInstallment: 667, planMonthsLeft: 1});
    expect(cardPaymentSplit(last, 400).installments).toBe(1);
  });

  it('never settles more months than the term has left', () => {
    const card = makeCard({balance: 800, planInstallment: 100, planMonthsLeft: 3, minPay: 250});
    expect(cardPaymentSplit(card, 5000).installments).toBe(3);
  });

  it('leaves a card with no plan alone', () => {
    expect(cardPaymentSplit(makeCard({balance: 1240, minPay: 160}), 160)).toEqual({
      revolvingPaid: 160,
      planPaid: 0,
      installments: 0,
    });
    // A plan whose balance was corrected out from under it owns no principal.
    expect(
      cardPaymentSplit(makeCard({balance: 0, planInstallment: 100, planMonthsLeft: 3}), 100)
        .installments,
    ).toBe(0);
  });

  it('counts installments in whole cents', () => {
    // Math.floor(30.15 / 10.05) is 2 in binary floating point, not 3, so a
    // three-month prepayment would quietly settle two months.
    const card = makeCard({balance: 30.15, planInstallment: 10.05, planMonthsLeft: 3});
    expect(cardPaymentSplit(card, 30.15).installments).toBe(3);
  });

  it('retires the term exactly as the balance clears', () => {
    // Walk the plan paying each bill as billed: the term must reach zero on
    // the same month the debt does, neither early nor late.
    let balance = 8500;
    let monthsLeft = 12;
    let months = 0;
    while (monthsLeft > 0 && months < 20) {
      const card = makeCard({
        balance,
        payInFull: true,
        planInstallment: 667,
        planMonthsLeft: monthsLeft,
      });
      const due = cardPaymentDue(card, null);
      monthsLeft -= cardPaymentSplit(card, due).installments;
      balance = round2(balance - due);
      months += 1;
    }
    expect(months).toBe(12);
    expect(balance).toBe(0);
    expect(monthsLeft).toBe(0);
  });
});
