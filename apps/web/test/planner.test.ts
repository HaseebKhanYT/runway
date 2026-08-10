import {
  computeRunway,
  cycleDays,
  demoData,
  goalPerPaycheck,
  toIsoDate,
  type AppState,
  type Cadence,
} from '@runway/shared';
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
 * Re-anchor the fixture onto another pay cadence, as a `mutate` the existing
 * helper already takes — so every call site below keeps working and a cadence
 * case composes with `roomyCard` rather than replacing it.
 *
 * The fixture is biweekly, and `cycleDays('biweekly')` is exactly the 14 the
 * planner used to hardcode, so a suite that only ever runs at 14 days cannot
 * tell a cadence-aware divisor from a constant. The pay date moves with the
 * cadence because the fixture puts `nextPay` one whole cycle out: a weekly
 * earner whose payday is a fortnight away is a different scenario, not a
 * weekly one.
 */
function atCadence(cadence: Cadence) {
  return (s: AppState): AppState => ({
    ...s,
    profile: {...s.profile, cadence, nextPay: toIsoDate(TODAY, cycleDays(cadence))},
  });
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

/**
 * `roomyCard`'s Card B with the limit and the interest lifted out of the way,
 * so what the card lever asks for is bounded by the plan rather than by the
 * card. The due day and the payment bill still come from `roomyCard`.
 */
function lendingCard(s: AppState): AppState {
  const roomy = roomyCard(s);
  return {
    ...roomy,
    cards: roomy.cards.map((c) =>
      c.id === 'cardb' ? {...c, limit: 5000000, balance: 0, apr: 0, promoEnd: null} : c,
    ),
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

  it('spreads the set-aside over the days the cadence actually has to cover', () => {
    // The per-day line turns a per-paycheck set-aside into a daily one, so its
    // divisor is the length of a cycle. Hardcoded at 14 it quoted the same
    // $140 wish at four prices — $1/day weekly, $5/day monthly — by dividing a
    // week's money and a month's money by a fortnight. Dividing by `cycleDays`
    // lands all four on $2/day, which is the answer: the same wish costs the
    // same per day whoever you are, and only the per-paycheck figure moves.
    const line = (cadence: Cadence) =>
      plan({target: 140, months: 3, kind: 'wish'}, atCadence(cadence)).perLine;

    expect(line('weekly')).toBe("That's $13 per paycheck — about $2/day less to spend.");
    expect(line('biweekly')).toBe("That's $28 per paycheck — about $2/day less to spend.");
    expect(line('semimonthly')).toBe("That's $28 per paycheck — about $2/day less to spend.");
    expect(line('monthly')).toBe("That's $70 per paycheck — about $2/day less to spend.");
    // The per-paycheck halves of those lines are what a cadence is allowed to
    // change, so the strings still differ end to end.
    expect(line('weekly')).not.toBe(line('monthly'));
  });

  it('quotes the earn lever at the paychecks the cadence brings, not at two', () => {
    // `remainingGap` is per paycheck and the lever is quoted per month, so the
    // step between them is `cyclesPerMonth`. A flat 2 asked a monthly earner
    // for twice their shortfall and a weekly earner for under half of it.
    const earn = (cadence: Cadence) =>
      plan({target: 20000, months: 3, kind: 'necessity'}, atCadence(cadence)).earnMonthly;

    // 4.348 weekly paychecks a month against a $499.14/paycheck gap: $2,180,
    // where the constant quoted $1,000.
    expect(earn('weekly')).toBe(2180);
    // 2.174, not 2: the fixture's own cadence was 8.7% short as well, which is
    // the correction the issue missed.
    expect(earn('biweekly')).toBe(6580);
    // Exactly 2 paydays a month, so semimonthly is the one cadence the
    // constant was accidentally right about.
    expect(earn('semimonthly')).toBe(6160);
    // One paycheck a month: the $9,829.48 gap is the whole monthly ask, and
    // the constant doubled it to $19,660.
    expect(earn('monthly')).toBe(9830);
  });

  it('asks the card for the principal the cadence implies', () => {
    // A $3,000 necessity on a weekly cycle. Turning a per-paycheck shortfall
    // back into a principal takes the paychecks in the term — 4.348 a month —
    // so the lever asks for $809 and the gap closes exactly. Sized against a
    // flat 2 the same lever asked for $640 and then refused the plan over the
    // $7.31/paycheck that left behind, which is the #17 failure the loop was
    // written to prevent.
    const weekly = plan({target: 3000, months: 1, kind: 'necessity', cardId: 'cardb'}, (s) =>
      lendingCard(atCadence('weekly')(s)),
    );
    expect(weekly.financed).toBe(809);
    expect(weekly.remainingGap).toBe(0);
    expect(weekly.covered).toBe(true);
    expect(weekly.ctaEnabled).toBe(true);

    // The same conversion the other way round. A monthly earner's cycle is a
    // month, so a 6-month term holds 6 paychecks and not 12, and each pass asks
    // for half of what the flat 2 asked. What that changes is the length of the
    // stride, not where the strides are headed: both divisors walk up to the
    // answer from below, so the honest one cannot land past it the way the flat 2
    // landed past the $500 case below. It asks for more here, not less — $900
    // against the old code's $840 — and that is the point. The $840 was not a
    // smaller, kinder ask: it was a stride the four-pass budget cut off $1.48 a
    // paycheck short, so the plan came out refused. $900 is what closes the gap,
    // and it takes the last of the twenty passes the loop is allowed to reach it.
    const monthly = plan({target: 1000, months: 6, kind: 'necessity', cardId: 'cardb'}, (s) =>
      lendingCard(atCadence('monthly')(s)),
    );
    expect(monthly.financed).toBe(900);
    expect(monthly.remainingGap).toBe(0);
    expect(monthly.covered).toBe(true);
    expect(monthly.ctaEnabled).toBe(true);
  });

  it('still comes good on the smaller principal the corrected divisor asks for', () => {
    // The flat 2 over-asked at `monthly` badly enough that it shoved `financed`
    // onto the ceiling — the whole $500 — and closed the gap by accident. The
    // honest divisor opens at $314 and walks up as the installment it adds keeps
    // pushing part of the shortfall back, settling at $483: the plan has to come
    // good on the smaller ask rather than on the over-borrowing, and it does.
    //
    // It takes ten passes to get there. At the four the loop used to allow it
    // stopped at $461, still $3.48 a paycheck short and refused — so correcting
    // the divisor without widening the budget would have made a plan that was
    // lockable before the fix unlockable after it, on a term it can carry.
    const summary = plan({target: 500, months: 3, kind: 'necessity', cardId: 'cardb'}, (s) =>
      lendingCard(atCadence('monthly')(s)),
    );
    expect(summary.financed).toBe(483);
    expect(summary.remainingGap).toBe(0);
    expect(summary.covered).toBe(true);
    expect(summary.ctaEnabled).toBe(true);
  });

  it('sizes the card by the shortfall even where no card can cover the plan', () => {
    // $40,000 over 6 months on a weekly cycle. Here the loop runs out of plan
    // before it runs out of passes: `ceiling` is the target itself, so the lever
    // ends up putting the whole $40,000 on the card, against the $15,761 a flat
    // 2 stopped at. The answer is still no, and it is neither the divisor nor
    // the budget that says so — a $6,667/month installment falls inside a 7-day
    // cycle, against a $6,000 balance that also owes rent, so `safe` is what
    // binds and borrowing is what moves it the wrong way: it was $1,331 at the
    // $15,761 the old code stopped at and is −$1,699 at the ceiling. The plan
    // for #53 expected this case to flip to covered; it does not, and asking the
    // card for more is precisely what does not make it.
    const summary = plan({target: 40000, months: 6, kind: 'necessity', cardId: 'cardb'}, (s) =>
      lendingCard(atCadence('weekly')(s)),
    );
    expect(summary.financed).toBe(40000);
    expect(summary.projection.safe).toBe(-1699);
    expect(summary.covered).toBe(false);
    expect(summary.ctaEnabled).toBe(false);
  });
});
