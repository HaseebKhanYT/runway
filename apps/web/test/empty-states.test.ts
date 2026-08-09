import type {Bill} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {ACTIVITY_EMPTY, railEmptyState} from '../src/lib/empty-states';

const NEVER_RECORDED = 'No bills yet — the ones you add appear here with the day they are due.';
const ALL_PAID = 'Every bill is paid — your runway is clear until payday.';
const NONE_ON_RAIL = 'No unpaid bill falls between today and payday.';

function makeBill(partial: Partial<Bill>): Bill {
  return {
    id: 'b1',
    name: 'Electric',
    amount: 120,
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

describe('railEmptyState', () => {
  it('no bill has ever been recorded', () => {
    expect(railEmptyState([])).toEqual({line: NEVER_RECORDED, cta: 'Add a bill'});
  });

  it('every bill is paid', () => {
    const bills = [makeBill({id: 'b1', paid: true}), makeBill({id: 'b2', paid: true})];
    expect(railEmptyState(bills)).toEqual({line: ALL_PAID, cta: 'See your bills'});
  });

  it('a mix of paid and unpaid claims neither', () => {
    const bills = [makeBill({id: 'b1', paid: true}), makeBill({id: 'b2', paid: false})];
    const state = railEmptyState(bills);
    expect(state).toEqual({line: NONE_ON_RAIL, cta: 'See your bills'});
    // Both other lines would be false of this account, and the point of the
    // third branch is that it never tells the user either of them.
    expect(state.line).not.toBe(NEVER_RECORDED);
    expect(state.line).not.toBe(ALL_PAID);
  });

  it('one unpaid bill alone claims neither', () => {
    expect(railEmptyState([makeBill({paid: false})])).toEqual({
      line: NONE_ON_RAIL,
      cta: 'See your bills',
    });
  });
});

describe('ACTIVITY_EMPTY', () => {
  it('says what the list will hold and how to fill it', () => {
    expect(ACTIVITY_EMPTY).toEqual({
      line: 'Spending and income show up here as you log them.',
      cta: 'Add expense',
    });
  });
});
