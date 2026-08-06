import {demoData, type Txn} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {ACTIVITY_WINDOW_DAYS, windowTotals} from '../src/lib/activity-totals';

const TODAY = new Date('2026-07-16T12:00:00');

let seq = 0;

/** A transaction that carries only what the totals read: an offset and an amount. */
function txn(off: number, amount: number): Txn {
  seq += 1;
  return {
    id: `t${seq}`,
    label: 'row',
    amount,
    cat: 'Eating out',
    postedAt: TODAY.toISOString(),
    off,
    src: null,
    cardId: null,
    billId: null,
  };
}

describe('windowTotals', () => {
  it('leaves a transaction older than the window out of all three figures', () => {
    // #144: the tiles were captioned "last 14 days" but summed the whole
    // account, so one old paycheck inflated every figure on the page.
    const totals = windowTotals([txn(-90, 14000), txn(0, 22), txn(-1, -6)]);
    expect(totals.moneyIn).toBeCloseTo(22);
    expect(totals.moneyOut).toBeCloseTo(6);
    expect(totals.net).toBeCloseTo(16);
  });

  it('counts offset −13 and excludes offset −14', () => {
    // 14 days counting today, so the window is −13 through 0 inclusive.
    expect(windowTotals([txn(-13, -5)]).moneyOut).toBeCloseTo(5);
    expect(windowTotals([txn(-14, -5)]).moneyOut).toBe(0);
  });

  it("counts today's transactions and ignores future-dated ones", () => {
    const totals = windowTotals([txn(0, 30), txn(1, 5000)]);
    expect(totals.moneyIn).toBeCloseTo(30);
    expect(totals.net).toBeCloseTo(30);
  });

  it('returns zeros for no transactions', () => {
    expect(windowTotals([])).toEqual({moneyIn: 0, moneyOut: 0, net: 0});
  });

  it('returns zeros when everything on the account predates the window', () => {
    expect(windowTotals([txn(-14, 1700), txn(-60, -2500), txn(-90, 14000)])).toEqual({
      moneyIn: 0,
      moneyOut: 0,
      net: 0,
    });
  });

  it('counts a zero-amount transaction as neither money in nor money out', () => {
    const totals = windowTotals([txn(-2, 0)]);
    expect(totals.moneyIn).toBe(0);
    expect(totals.moneyOut).toBe(0);
    expect(totals.net).toBe(0);
  });

  it('reports money out as a positive number, and net as in minus out', () => {
    const totals = windowTotals([txn(-4, 100), txn(-5, -40)]);
    expect(totals.moneyOut).toBeCloseTo(40);
    expect(totals.net).toBeCloseTo(60);
  });

  it('honours a shorter window when asked for one', () => {
    const txns = [txn(0, 10), txn(-2, 20)];
    expect(windowTotals(txns, 2).moneyIn).toBeCloseTo(10);
    expect(windowTotals(txns, 3).moneyIn).toBeCloseTo(30);
  });

  it('totals the demo seed plus older rows over the default window', () => {
    // The seed spans offsets 0 to −14: its −14 paycheck of 1700 falls outside,
    // as do the backdated rows, leaving 22 in and 1374.09 + 6 out.
    const totals = windowTotals([
      ...demoData(TODAY).txns,
      txn(-90, 14000),
      txn(-60, -2500),
      txn(-14, 500),
      txn(-13, -6),
    ]);
    expect(ACTIVITY_WINDOW_DAYS).toBe(14);
    expect(totals.moneyIn).toBeCloseTo(22);
    expect(totals.moneyOut).toBeCloseTo(1380.09);
    expect(totals.net).toBeCloseTo(-1358.09);
  });
});
