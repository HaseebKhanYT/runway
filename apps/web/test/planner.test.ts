import {computeRunway, demoData, goalPerPaycheck, type AppState} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {formatMoney} from '../src/lib/format';
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

/** Card B's promotion at a rate that is cheap rather than free (#25). */
function promoCard(s: AppState): AppState {
  const roomy = roomyCard(s);
  return {
    ...roomy,
    cards: roomy.cards.map((c) => (c.id === 'cardb' ? {...c, promoRate: 4.9} : c)),
  };
}

describe('computePlan', () => {
  it('fits a small wish inside the demo seed spare balance', () => {
    const summary = plan();
    // 280 by 1 September, which is three paychecks away from 16 July — not
    // the four that "2 months × 2" would assume.
    expect(summary.perPaycheck).toBe(94);
    expect(summary.over).toBe(false);
    expect(summary.covered).toBe(true);
    expect(summary.levers).toEqual([]);
    expect(summary.ctaLabel).toBe('Start this plan');
    expect(summary.ctaEnabled).toBe(true);
    expect(summary.perLine).toContain('per paycheck');
  });

  it('offers the levers that cost nothing before the one that creates debt', () => {
    const summary = plan({target: 8000, months: 1, kind: 'necessity'});
    // One paycheck lands before 1 August, so the whole $8,000 falls on it.
    expect(summary.perPaycheck).toBe(8000);
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
    expect(summary.gapLine).toMatch(/^Still \$[\d,.]+ short every paycheck/);
    expect(summary.ctaLabel).toBe('Lock this plan in');
    expect(summary.ctaEnabled).toBe(false);
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
    // is found, but the installment sinks the runway anyway.
    const summary = plan({target: 8000, months: 1, kind: 'necessity', cardId: 'cardb'}, roomyCard);
    expect(summary.financed).toBeGreaterThan(0);
    expect(summary.projection.safe).toBeLessThan(0);
    expect(summary.solvent).toBe(false);
    expect(summary.covered).toBe(false);
    expect(summary.ctaEnabled).toBe(false);
    expect(summary.gapLine).toContain('short every paycheck');
  });

  it('refuses a plan the balance covers but the paycheck does not', () => {
    // $8,000 over 2 months: $1,897 still safe before payday, so the crunch
    // panel would stay quiet — but the cycle runs $1,701 short, and the daily
    // number the whole app is built around sits at −$122. A plan that leaves
    // you spending savings faster than you earn has not solved anything, so
    // the balance covering it this once does not make it covered.
    const summary = plan({target: 8000, months: 2, kind: 'necessity'});
    expect(summary.solvent).toBe(true);
    expect(summary.sustainable).toBe(false);
    expect(summary.projection.effectivePerDay).toBe(-121);
    expect(summary.covered).toBe(false);
    expect(summary.ctaEnabled).toBe(false);
    expect(summary.gapLine).toContain('−$121/day');
  });

  it('never calls a plan covered that would sink the daily number', () => {
    // The invariant the levers exist to protect, swept across terms, targets
    // and funding sources: whatever combination gets picked, a plan is only
    // ever covered if what it leaves you to spend per day is still positive.
    let anyCovered = false;
    for (const target of [500, 2000, 5000, 8000, 20000]) {
      for (const months of [1, 6, 12, 36]) {
        for (const cardId of [null, 'cardb', 'carda']) {
          for (const earn of [false, true]) {
            const summary = plan({target, months, kind: 'necessity', cardId, earn}, roomyCard);
            if (summary.covered) {
              anyCovered = true;
              expect(summary.projection.effectivePerDay).toBeGreaterThanOrEqual(0);
              expect(summary.projection.safe).toBeGreaterThanOrEqual(0);
              expect(summary.projection.cycleSurplus).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
    // Guard against the sweep passing because nothing was ever covered.
    expect(anyCovered).toBe(true);
  });

  it('answers the shortfall with the term that actually clears it', () => {
    // A fixed "+6 months" was a nudge, not an answer: it left the user
    // clicking with no promise anything would ever come good. The lever now
    // names the soonest term that gets the day back above zero, and taking it
    // once is enough.
    const short = plan({target: 8000, months: 1, kind: 'necessity'});
    expect(short.covered).toBe(false);
    expect(short.minViableMonths).toBe(5);
    const extend = short.levers.find((l) => l.kind === 'extend');
    expect(extend?.months).toBe(5);
    expect(extend?.title).toBe('Give it 4 more months');
    expect(short.gapLine).toContain('stretch it to 5 months');

    const after = plan({target: 8000, months: 5, kind: 'necessity'});
    expect(after.covered).toBe(true);
    expect(after.projection.effectivePerDay).toBeGreaterThanOrEqual(0);
  });

  it('withholds the extend lever when no term inside five years works', () => {
    const summary = plan({target: 200000, months: 1, kind: 'necessity'}, roomyCard);
    expect(summary.minViableMonths).toBeNull();
    expect(summary.levers.some((l) => l.kind === 'extend')).toBe(false);
    expect(summary.gapLine).toContain('free up more or aim lower');
  });

  it('quotes the set-aside the runway will actually charge', () => {
    // `target / (months × 2)` assumes a term of N months contains 2N
    // paychecks. Two months from 16 July ends 1 September, and only three
    // paychecks land before it — so the honest figure is $2,667, not $2,000.
    const summary = plan({target: 8000, months: 2, kind: 'necessity'});
    expect(summary.perPaycheck).toBe(2667);
    const state = demoData(TODAY);
    const planned = {
      id: '__p',
      name: 'x',
      target: 8000,
      saved: 0,
      per: 2000,
      note: '',
      due: '2026-09-01',
      necessity: true,
      paused: null,
      behind: false,
      financed: 0,
      financedFrom: null,
      earnMonthly: 0,
    };
    expect(goalPerPaycheck(planned, state.profile.cadence, TODAY)).toBe(summary.perPaycheck);
  });

  it('holds a wish to the same bar as a necessity', () => {
    // A wish that sinks the day is no more worth starting than a necessity
    // that does; the spare balance is not headroom for either.
    const summary = plan({target: 8000, months: 2, kind: 'wish'});
    expect(summary.projection.effectivePerDay).toBeLessThan(0);
    expect(summary.covered).toBe(false);
    expect(summary.ctaEnabled).toBe(false);
    expect(summary.perLine).toContain('daily number going negative');
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

  it('names a live promotional rate instead of the rate it reverts to', () => {
    // A 4.9% promotion is still a promotion. Testing for 0% called this card
    // "21.9% APR" while the sort directly above had already ordered it by the
    // 4.9% it charges today (#25).
    const summary = plan(
      {target: 40000, months: 12, kind: 'necessity', cardId: 'cardb'},
      promoCard,
    );
    const lever = summary.levers.find((l) => l.kind === 'card' && l.id === 'cardb');
    expect(lever?.title).toBe('Put the rest on Card B · 4.9% until Dec 2026');
    expect(lever?.title).not.toContain('21.9% APR');
  });

  it('quotes the lever the interest the plan charges once that card is picked', () => {
    // The lever priced the whole term at the promo rate while the summary
    // split it at the cliff, so choosing the card the lever recommended
    // changed the number it had just promised. One cost model, one figure.
    const summary = plan(
      {target: 40000, months: 12, kind: 'necessity', cardId: 'cardb'},
      promoCard,
    );
    expect(summary.interest).toBe(1572);
    const lever = summary.levers.find((l) => l.kind === 'card' && l.id === 'cardb');
    expect(lever?.sub).toBe(`≈${formatMoney(summary.interest)} interest over 12 mo`);
  });

  it('leaves a card with no promotion priced exactly as it was', () => {
    // The blast radius of pricing every lever through `planInterest`: for a
    // card with no live promo it collapses to the single-rate formula it
    // replaced, so Card A's row must not move by a cent.
    const summary = plan(
      {target: 40000, months: 12, kind: 'necessity', cardId: 'cardb'},
      promoCard,
    );
    const lever = summary.levers.find((l) => l.kind === 'card' && l.id === 'carda');
    expect(lever?.title).toBe('Put the rest on Card A · 17.9% APR');
    expect(lever?.sub).toBe('≈$203.00 interest over 12 mo');
  });
});
