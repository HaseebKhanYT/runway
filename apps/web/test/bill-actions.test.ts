import type {Bill} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {canDeleteBill} from '../src/lib/bill-actions';

function makeBill(partial: Partial<Bill>): Bill {
  return {
    id: 'b1',
    name: 'Rent',
    amount: 1200,
    kind: 'survival',
    dueDate: '2026-07-21',
    cycle: 'monthly',
    paid: false,
    payFrom: null,
    cardId: null,
    oneTime: false,
    personal: false,
    lender: null,
    ...partial,
  };
}

describe('canDeleteBill', () => {
  it("withholds delete from a card's payment bill", () => {
    const bill = makeBill({name: 'Card A payment', kind: 'debt', cardId: 'c1', amount: 160});
    expect(canDeleteBill(bill)).toBe(false);
  });

  // Regression: gating on `kind === 'debt'` instead of `cardId` would make a
  // friend loan permanently undeletable. The DEBT group holds both kinds.
  it('allows deleting a friend loan, which is a debt bill the user owns', () => {
    const bill = makeBill({
      name: 'Pay back Sam',
      kind: 'debt',
      cardId: null,
      personal: true,
      lender: 'Sam',
      amount: 50,
    });
    expect(canDeleteBill(bill)).toBe(true);
  });

  it('allows deleting a survival bill', () => {
    expect(canDeleteBill(makeBill({}))).toBe(true);
  });

  it('allows deleting a subscription', () => {
    const bill = makeBill({name: 'Spotify', kind: 'subscription', amount: 11.99});
    expect(canDeleteBill(bill)).toBe(true);
  });
});
