import {describe, expect, it} from 'vitest';
import {computeRunway} from '../src/runway';
import type {AppState, Bill} from '../src/types';

const TODAY = new Date('2026-07-16T12:00:00');

/** ISO date `off` days after TODAY, in TODAY's own zone. */
function dueIn(off: number): string {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + off);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `off` is a convenience for the test's own clock; the bill only carries a date. */
function makeBill({off, ...partial}: Partial<Bill> & {off?: number}): Bill {
  return {
    id: 'b1',
    name: 'Bill',
    amount: 100,
    kind: 'survival',
    dueDate: dueIn(off ?? 3),
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

/** Run `fn` with the process pretending to sit in `tz`. */
function inZone<T>(tz: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = previous;
  }
}

function makeState(partial: Partial<AppState>): AppState {
  return {
    profile: {
      name: 'Test',
      email: 't@example.com',
      cadence: 'biweekly',
      nextPay: null,
      payAmount: 1700,
      primaryName: 'Main checking',
      primaryBalance: 1000,
      primaryLogo: null,
      notifBills: true,
      notifWeekly: false,
      onboarded: true,
    },
    accounts: [],
    bills: [],
    cats: [],
    txns: [],
    deletedTxns: [],
    goals: [],
    cards: [],
    ...partial,
  };
}

describe('computeRunway', () => {
  it('computes the plan example', () => {
    const state = makeState({
      profile: {
        ...makeState({}).profile,
        nextPay: '2026-07-26', // 10 days out
      },
      bills: [
        makeBill({id: 'b1', amount: 100, off: 3}),
        makeBill({id: 'b2', amount: 500, off: 5, paid: true}),
      ],
      goals: [
        {
          id: 'g1',
          name: 'G',
          target: 1000,
          saved: 400,
          per: 40,
          note: '',
          due: null,
          necessity: false,
          paused: null,
          behind: false,
          financed: 0,
          financedFrom: null,
          earnMonthly: 0,
        },
      ],
    });
    const r = computeRunway(state, TODAY);
    expect(r.cycleLength).toBe(14);
    expect(r.daysToPayday).toBe(10);
    expect(r.billsDueBeforePayday).toBe(100);
    expect(r.setAside).toBe(40);
    expect(r.safe).toBe(860);
    expect(r.thisCyclePerDay).toBe(86);
    // billsMonthly 600 -> perCycle 600*14/30.44 = 275.95; surplus 1384.05 -> floor(/14)=98
    expect(r.sustainablePerDay).toBe(98);
    expect(r.effectivePerDay).toBe(86);
    expect(r.squeezed).toBe(false);
    expect(r.overCommitted).toBe(false);
  });

  it('bills due on/after payday are excluded from safe', () => {
    const state = makeState({
      profile: {...makeState({}).profile, nextPay: '2026-07-26'},
      bills: [
        makeBill({id: 'b1', amount: 100, off: 10}),
        makeBill({id: 'b2', amount: 50, off: 12}),
      ],
    });
    const r = computeRunway(state, TODAY);
    expect(r.billsDueBeforePayday).toBe(0);
    expect(r.safe).toBe(1000);
  });

  it('negative safe rounds per-day away from zero', () => {
    const state = makeState({
      profile: {...makeState({}).profile, primaryBalance: 50},
      bills: [makeBill({amount: 100, off: 2})],
    });
    const r = computeRunway(state, TODAY);
    expect(r.daysToPayday).toBe(14); // no nextPay -> full cycle
    expect(r.safe).toBe(-50);
    expect(r.thisCyclePerDay).toBe(-4); // -ceil(50/14)
  });

  it('yearly subscriptions count as amount/12; one-time and personal excluded', () => {
    const state = makeState({
      bills: [
        makeBill({id: 'y', amount: 120, cycle: 'yearly', off: 40}),
        makeBill({id: 'o', amount: 999, oneTime: true, off: 5, paid: true}),
        makeBill({id: 'p', amount: 500, personal: true, off: 6, paid: true}),
      ],
    });
    const r = computeRunway(state, TODAY);
    // billsMonthly = 10 -> perCycle 10*14/30.44 = 4.599; surplus 1695.4 -> 121
    expect(r.sustainablePerDay).toBe(121);
  });

  it('clamps daysToPayday into [1, cycleLength] and flags squeezed/overcommitted', () => {
    const squeezedState = makeState({
      profile: {
        ...makeState({}).profile,
        primaryBalance: 10000,
        payAmount: 500,
        nextPay: '2026-08-30', // far out -> clamp to 14
      },
      bills: [makeBill({amount: 400, off: 2})],
    });
    const r = computeRunway(squeezedState, TODAY);
    expect(r.daysToPayday).toBe(14);
    // thisCyclePerDay floor(9600/14)=685; billsMonthly 400 -> perCycle 183.97; surplus 316.03 -> 22
    expect(r.sustainablePerDay).toBe(22);
    expect(r.effectivePerDay).toBe(22);
    expect(r.squeezed).toBe(true);

    const overState = makeState({
      profile: {...makeState({}).profile, payAmount: 100},
      bills: [makeBill({amount: 400, off: 2, paid: true})],
    });
    const o = computeRunway(overState, TODAY);
    // surplus = 100 - 183.97 = -83.97 -> sustainablePerDay -ceil(83.97/14) = -6
    expect(o.overCommitted).toBe(true);
    expect(o.sustainablePerDay).toBe(-6);
  });

  it('excludes a bill due exactly on payday, and includes the day before', () => {
    const state = makeState({
      profile: {...makeState({}).profile, nextPay: '2026-07-26'},
      bills: [
        makeBill({id: 'onPayday', amount: 100, dueDate: '2026-07-26'}),
        makeBill({id: 'dayBefore', amount: 40, dueDate: '2026-07-25'}),
      ],
    });
    const r = computeRunway(state, TODAY);
    expect(r.daysToPayday).toBe(10);
    expect(r.billsDueBeforePayday).toBe(40);
  });

  it('reads both halves of the pre-payday filter off the same clock in any zone', () => {
    // One instant: 18:00 on 16 July in Los Angeles, already 17 July in UTC. The
    // day counts differ by one between the zones, but the classification of a
    // bill due on payday must not — that is the off-by-one in #84.
    const instant = '2026-07-17T01:00:00Z';
    const state = makeState({
      profile: {...makeState({}).profile, nextPay: '2026-07-26'},
      bills: [makeBill({id: 'onPayday', amount: 100, dueDate: '2026-07-26'})],
    });
    const la = inZone('America/Los_Angeles', () => computeRunway(state, new Date(instant)));
    const utc = inZone('UTC', () => computeRunway(state, new Date(instant)));
    expect(la.daysToPayday).toBe(10);
    expect(utc.daysToPayday).toBe(9);
    expect(la.billsDueBeforePayday).toBe(0);
    expect(utc.billsDueBeforePayday).toBe(0);
  });

  it('paused and funded goals do not set aside', () => {
    const base = makeState({}).goals;
    const state = makeState({
      goals: [
        {
          id: 'g1',
          name: 'Paused',
          target: 1000,
          saved: 0,
          per: 50,
          note: '',
          due: null,
          necessity: false,
          paused: '__crunch',
          behind: false,
          financed: 0,
          financedFrom: null,
          earnMonthly: 0,
        },
        {
          id: 'g2',
          name: 'Done',
          target: 100,
          saved: 100,
          per: 25,
          note: '',
          due: null,
          necessity: false,
          paused: null,
          behind: false,
          financed: 0,
          financedFrom: null,
          earnMonthly: 0,
        },
      ],
    });
    void base;
    expect(computeRunway(state, TODAY).setAside).toBe(0);
  });

  it('accounts pool into the balance', () => {
    const state = makeState({
      accounts: [{id: 'a1', name: 'Wallet cash', type: 'cash', balance: 250, logo: null}],
    });
    expect(computeRunway(state, TODAY).safe).toBe(1250);
  });
});
