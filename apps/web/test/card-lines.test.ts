import type {Bill, Card} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {cardLine, rewardPillColors} from '../src/lib/card-lines';

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

describe('rewardPillColors', () => {
  it('colors by category keyword', () => {
    expect(rewardPillColors('groceries')).toEqual({bg: '#e3eedd', fg: '#2e5c38'});
    expect(rewardPillColors('gas')).toEqual({bg: '#f4e3cf', fg: '#8a5a1e'});
    expect(rewardPillColors('unknown thing')).toEqual({bg: '#eee7d9', fg: '#5c5142'});
  });
});

describe('cardLine', () => {
  const paymentBill: Bill = {
    id: 'b1',
    name: 'Card A payment',
    amount: 160,
    kind: 'debt',
    dueDate: '2026-07-21',
    off: 5,
    cycle: 'monthly',
    paid: false,
    payFrom: null,
    cardId: 'c1',
    oneTime: false,
    personal: false,
    lender: null,
  };

  it('paid off', () => {
    const line = cardLine(makeCard({balance: 0, limit: 2000}), undefined, TODAY);
    expect(line.text).toBe('Paid off — $2,000.00 available');
    expect(line.color).toBe('#2e7d4f');
  });

  it('pays in full with due day', () => {
    const line = cardLine(
      makeCard({payInFull: true, balance: 650, dueDay: 21}),
      {...paymentBill, amount: 650},
      TODAY,
    );
    expect(line.text).toBe('Pays in full Jul 21 — $650.00, $0 interest');
    expect(line.color).toBe('#2e7d4f');
  });

  it('pays in full without due day warns', () => {
    const line = cardLine(makeCard({payInFull: true, balance: 650}), undefined, TODAY);
    expect(line.text).toBe('Pays in full — add a due day so it lands on your runway');
    expect(line.color).toBe('#c2410c');
  });

  it('promo countdown', () => {
    const line = cardLine(
      makeCard({balance: 650, promoRate: 0, promoEnd: '2026-12-03', apr: 21.9}),
      undefined,
      TODAY,
    );
    expect(line.text).toBe('⏳ 0% ends Dec 2026 (5 mo) — clear $650.00 by then or it costs 21.9%');
    expect(line.color).toBe('#5c5142');
  });

  it('amortization with a payment bill', () => {
    const line = cardLine(makeCard({}), paymentBill, TODAY);
    expect(line.text).toBe('At $160.00/mo → clear by Apr 2027 · ≈$200.00 interest on the way');
  });

  it('payment below interest warns', () => {
    const line = cardLine(makeCard({}), {...paymentBill, amount: 5}, TODAY);
    expect(line.text).toBe("$5.00/mo doesn't cover the interest — raise the payment");
    expect(line.color).toBe('#c2410c');
  });

  it('no due date estimates monthly interest', () => {
    const line = cardLine(makeCard({balance: 1240, apr: 17.9}), undefined, TODAY);
    expect(line.text).toBe('No due date set — Edit to add one · interest ≈ $18.00/mo at 17.9%');
  });
});
