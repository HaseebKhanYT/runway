import {computeRunway, demoData, type AppState} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {computePlan} from '../src/lib/planner';

const TODAY = new Date('2026-07-16T12:00:00');

function plan(
  overrides: Partial<Parameters<typeof computePlan>[0]> = {},
  mutate: (s: AppState) => AppState = (s) => s,
) {
  const state = mutate(demoData(TODAY));
  const runway = computeRunway(state, TODAY);
  return computePlan(
    {
      name: 'Test plan',
      target: 280,
      months: 2,
      kind: 'wish',
      pausedIds: [],
      cardId: null,
      earn: false,
      ...overrides,
    },
    state,
    runway,
    TODAY,
  );
}

/**
 * Card B with room to lend, a due day, and the payment bill that a due day
 * always implies — `syncCardBill` creates one the moment a card gets a due
 * day, so a card carrying one without the other is a state the server cannot
 * produce, and the projection is entitled to assume it never sees one.
 */
function roomyCard(s: AppState): AppState {
  return {
    ...s,
    cards: s.cards.map((c) => (c.id === 'cardb' ? {...c, limit: 20000, dueDay: 20} : c)),
    bills: [
      ...s.bills,
      {
        id: 'cardb-pay',
        name: 'Card B payment',
        amount: 25,
        kind: 'debt' as const,
        dueDate: '2026-07-21',
        off: 5,
        cycle: 'monthly' as const,
        paid: false,
        payFrom: 'checking',
        cardId: 'cardb',
        oneTime: false,
        personal: false,
        lender: null,
      },
    ],
  };
}

describe('computePlan', () => {
  it('fits a small wish inside the demo seed spare balance', () => {
    const summary = plan();
    // 280 over 2 months = 4 paychecks
    expect(summary.perPaycheck).toBe(70);
    expect(summary.over).toBe(false);
    expect(summary.covered).toBe(true);
    expect(summary.levers).toEqual([]);
    expect(summary.ctaLabel).toBe('Start this plan');
    expect(summary.ctaEnabled).toBe(true);
    expect(summary.perLine).toContain('per paycheck');
  });

  it('offers the levers that cost nothing before the one that creates debt', () => {
    const summary = plan({target: 8000, months: 1, kind: 'necessity'});
    expect(summary.perPaycheck).toBe(4000);
    expect(summary.over).toBe(true);
    expect(summary.covered).toBe(false);
    // Pausing, stretching the term and earning are free; a card ends in
    // interest, so it comes last however cheap its APR is.
    expect(summary.levers.map((l) => l.kind)).toEqual([
      'pause',
      'pause',
      'extend',
      'earn',
      'card',
      'card',
    ]);
    // Cards are still ordered cheapest-first among themselves: Card B's live
    // 0% promo sorts ahead of Card A.
    expect(summary.levers.filter((l) => l.kind === 'card').map((l) => l.id)).toEqual([
      'cardb',
      'carda',
    ]);
    expect(summary.gapLine).toMatch(/^Still short /);
    expect(summary.ctaLabel).toBe('Lock this plan in');
    expect(summary.ctaEnabled).toBe(false);
  });

  it('offers a longer term as a lever, quoting what it drops the figure to', () => {
    const summary = plan({target: 8000, months: 1, kind: 'necessity'});
    const extend = summary.levers.find((l) => l.kind === 'extend');
    expect(extend?.months).toBe(7);
    // 8000 over 7 months of two paychecks, down from $4,000.
    expect(extend?.sub).toContain('$571.43');
  });

  it('projects the runway the plan would leave behind', () => {
    const before = computeRunway(demoData(TODAY), TODAY);
    const summary = plan({target: 2000, months: 10, kind: 'necessity'});
    // A real set-aside is created, so the projection is strictly worse than
    // today on both axes rather than merely echoing them.
    expect(summary.projection.safe).toBeLessThan(before.safe);
    expect(summary.projection.cycleSurplus).toBeLessThan(before.cycleSurplus);
    expect(summary.projection.effectivePerDay).toBeLessThanOrEqual(before.effectivePerDay);
  });

  it('refuses to call a plan covered when financing it wrecks the runway', () => {
    // The #37 scenario: a card with room for the whole target says the money
    // is found, but the installment sinks the runway before payday.
    const summary = plan({target: 8000, months: 1, kind: 'necessity', cardId: 'cardb'}, roomyCard);
    expect(summary.financed).toBeGreaterThan(0);
    expect(summary.projection.safe).toBeLessThan(0);
    expect(summary.solvent).toBe(false);
    expect(summary.covered).toBe(false);
    expect(summary.ctaEnabled).toBe(false);
    expect(summary.gapLine).toMatch(/The money is there, but/);
  });

  it('allows a plan the spare balance cushions, and says so', () => {
    // `cushioned` is a state the planner names on screen — per exceeds the
    // cycle surplus and the spare balance covers the difference. Gating on a
    // non-negative projected cycleSurplus would forbid exactly that, and
    // would retire the card lever with it, since an installment is a new
    // monthly outgoing and borrowing can never raise cycleSurplus.
    // $12,000 over 6 months: the projected cycle runs $22 short, and the
    // $3,590 still safe before payday is what carries it.
    const summary = plan({target: 12000, months: 6, kind: 'necessity'});
    expect(summary.projection.safe).toBeGreaterThanOrEqual(0);
    expect(summary.sustainable).toBe(false);
    expect(summary.solvent).toBe(true);
    expect(summary.covered).toBe(true);
    expect(summary.ctaEnabled).toBe(true);
    expect(summary.gapLine).toContain('leans on your spare balance');
  });

  it('never calls a plan covered that would leave the runway negative', () => {
    // The invariant behind the whole issue, swept across terms and targets.
    for (const target of [500, 2000, 5000, 8000, 20000]) {
      for (const months of [1, 6, 12, 36]) {
        for (const cardId of [null, 'cardb', 'carda']) {
          const summary = plan({target, months, kind: 'necessity', cardId}, roomyCard);
          if (summary.covered) {
            expect(summary.projection.safe).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('no longer treats the earn lever alone as coverage', () => {
    // Earning is a promise, not a deposit. It cannot make an unaffordable
    // plan affordable on its own (#22, #37).
    const summary = plan({target: 8000, months: 1, kind: 'necessity', earn: true});
    expect(summary.covered).toBe(false);
    expect(summary.ctaEnabled).toBe(false);
    expect(summary.earnMonthly).toBeGreaterThan(0);
  });

  it('reports the total cost of borrowing, not only the principal', () => {
    const summary = plan({target: 8000, months: 1, kind: 'necessity', cardId: 'carda'});
    expect(summary.financed).toBeGreaterThan(0);
    expect(summary.interest).toBeGreaterThan(0);
    expect(summary.totalCost).toBe(summary.financed + summary.interest);
  });

  it('costs the months past a promotional window at the reversion rate', () => {
    // Card B's promo ends 140 days out — about 4 months. A 12-month term runs
    // past it, so the plan is not free and must not be quoted as free.
    const summary = plan(
      {target: 40000, months: 12, kind: 'necessity', cardId: 'cardb'},
      roomyCard,
    );
    expect(summary.promoCliff).not.toBeNull();
    expect(summary.promoCliff?.covered).toBe(4);
    expect(summary.promoCliff?.exposed).toBe(8);
    expect(summary.promoCliff?.reversionApr).toBe(21.9);
    expect(summary.interest).toBeGreaterThan(0);
  });

  it('reports no cliff when the term finishes inside the promo', () => {
    const summary = plan({target: 40000, months: 3, kind: 'necessity', cardId: 'cardb'}, roomyCard);
    expect(summary.promoCliff).toBeNull();
    expect(summary.interest).toBe(0);
  });
});
