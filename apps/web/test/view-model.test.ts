import {demoData, type AppState} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {buildViewModel} from '../src/lib/view-model';

const TODAY = new Date('2026-07-16T12:00:00');

function crunchState(): AppState {
  const state = demoData(TODAY);
  state.profile.primaryBalance = 500;
  return state;
}

/** Demo balance, but nothing committed and nothing coming in. */
function bareState(payAmount: number): AppState {
  const state = demoData(TODAY);
  state.profile.payAmount = payAmount;
  state.bills = [];
  state.goals = [];
  return state;
}

describe('buildViewModel', () => {
  it('renders squeezed hero for the demo seed', () => {
    const vm = buildViewModel(demoData(TODAY), TODAY);
    // preBills: rent 950 + electric 74 + phone 45 + carda 160 + netflix 15.49 + gym 40 = 1284.49
    expect(vm.runway.billsDueBeforePayday).toBeCloseTo(1284.49);
    // setAside: japan per (due 2027-04-01, 259 days, 18 checks -> ceil(1540/18)=86) + efund 40
    expect(vm.runway.setAside).toBe(126);
    expect(vm.runway.safe).toBeCloseTo(4589.51);
    expect(vm.runway.squeezed).toBe(true);
    expect(vm.heroSub).toContain('a pace that still works after payday');
    expect(vm.perDaySub).toBe('a pace that lasts past payday');
    expect(vm.unpaidBillCount).toBe(6);
    expect(vm.acctChipTag).toBe('▾');
    // A healthy seed keeps the calm colour — the zero rules below must not
    // bleed into it.
    expect(vm.heroColor).toBe('#f6f0e6');
    expect(vm.perDayColor).toBe('#29221a');
  });

  it('does not offer the whole balance once the payday date has gone stale', () => {
    // #56: a payday nobody confirmed slides into the past. The dashboard used
    // to divide the balance by one day and print it as this cycle's pace.
    const state = demoData(TODAY);
    state.profile.nextPay = '2026-07-15'; // yesterday
    const vm = buildViewModel(state, TODAY);
    expect(vm.daysToPay).toBe(13);
    expect(vm.paydayLabel).not.toBe(vm.todayShort);
    expect(vm.heroSub).not.toContain(vm.balanceF);
    expect(vm.runway.thisCyclePerDay).toBeLessThan(vm.balance);
  });

  it('prints today, not tomorrow, when the payday on file is today', () => {
    // #154: the dashboard was reusing the divisor — floored to 1 so an
    // unconfirmed paycheck never divides the balance by no days — as the
    // calendar offset of the date, so every surface named tomorrow while
    // Settings named today.
    const state = demoData(TODAY);
    state.profile.nextPay = '2026-07-16'; // today
    const vm = buildViewModel(state, TODAY);
    expect(vm.paydayLabel).toBe(vm.todayShort);
    expect(vm.daysToPay).toBe(0);
    expect(vm.paydayChip).toBe('payday today');
    // The floor survives where it belongs: the balance still has to cover today.
    expect(vm.runway.daysToPayday).toBe(1);
  });

  it('still counts a future payday down, and falls back to the cycle length', () => {
    const future = buildViewModel(demoData(TODAY), TODAY); // seeded 14 days out
    expect(future.daysToPay).toBe(14);
    expect(future.paydayChip).toBe('payday in 14d');
    expect(future.paydayLabel).not.toBe(future.todayShort);

    const state = demoData(TODAY);
    state.profile.nextPay = '';
    const undated = buildViewModel(state, TODAY);
    expect(undated.daysToPay).toBe(14);
    expect(undated.paydayChip).toBe('payday in 14d');
  });

  it('renders crunch state', () => {
    const vm = buildViewModel(crunchState(), TODAY);
    expect(vm.runway.safe).toBeLessThan(0);
    expect(vm.heroColor).toBe('#e58c5b');
    expect(vm.heroSub).toBe(
      "bills due before payday exceed your balance — let's look at the runway",
    );
  });

  it('names the missing paycheck when there is no income on record', () => {
    const vm = buildViewModel(bareState(0), TODAY);
    expect(vm.perDayF).toBe('$0');
    expect(vm.runway.overCommitted).toBe(false);
    // $0/day is not a pace that lasts, so neither the colour nor the copy is
    // allowed to read as calm (#85).
    expect(vm.heroColor).toBe('#e58c5b');
    expect(vm.perDayColor).toBe('#c2542a');
    expect(vm.heroSub).toBe('no paycheck on record — add what lands on payday in Settings');
    expect(vm.perDaySub).toBe('no paycheck on record — add one in Settings');
  });

  it('flags the missing paycheck so a component never re-derives the rule', () => {
    // #155: the payday modal rendered an enabled "Yes — $0.00 landed" over a
    // handler that bails on `amount <= 0`, so two clicks sent no request. The
    // modal now branches on this flag, which has to travel with the copy that
    // already names the same state or the two drift apart.
    const bare = buildViewModel(bareState(0), TODAY);
    expect(bare.noIncome).toBe(true);
    expect(bare.heroSub).toBe('no paycheck on record — add what lands on payday in Settings');
    expect(bare.perDaySub).toBe('no paycheck on record — add one in Settings');

    const seed = buildViewModel(demoData(TODAY), TODAY);
    expect(seed.noIncome).toBe(false);
    expect(seed.heroSub).not.toContain('no paycheck on record');
    expect(seed.perDaySub).not.toContain('no paycheck on record');
  });

  it('says nothing is left over when the pace is zero but income exists', () => {
    // $10 a cycle floors to $0/day: honest, but not caused by a missing wage.
    // It is not caused by bills or goals either — this profile has neither, and
    // pinning the shipped "after bills & goals" copy here was pinning the #153
    // bug. $6,000 divided over 14 days is a fine pace; what collapses it is the
    // sustainable term, so the paycheck is what the copy has to name.
    const vm = buildViewModel(bareState(10), TODAY);
    expect(vm.perDayF).toBe('$0');
    expect(vm.heroColor).toBe('#e58c5b');
    expect(vm.perDayColor).toBe('#c2542a');
    expect(vm.runway.thisCyclePerDay).toBeGreaterThan(vm.runway.sustainablePerDay);
    expect(vm.heroSub).toBe('$10.00 a paycheck does not stretch to a dollar a day');
    expect(vm.perDaySub).toBe('$10.00 a paycheck does not stretch to a dollar a day');
  });

  it('names the balance when the pace is zero and nothing is committed', () => {
    // #153: the `stalled` arm was widened from `< 0` to `<= 0` by the #85 fix
    // and inherited copy written for the case where commitments really had
    // consumed the money. A profile with no bills and no goals was told its
    // bills and goals had eaten everything that was never there.
    for (const [balance, balanceF] of [
      [0, '$0.00'],
      [10, '$10.00'],
    ] as const) {
      const state = bareState(1700);
      state.profile.primaryBalance = balance;
      const vm = buildViewModel(state, TODAY);
      expect(vm.runway.effectivePerDay).toBe(0);
      // This cycle is the binding term, so the balance — not the wage — is why.
      expect(vm.runway.thisCyclePerDay).toBeLessThanOrEqual(vm.runway.sustainablePerDay);
      expect(vm.heroSub).toBe(
        `${balanceF} is all there is until payday — nothing is committed against it`,
      );
      expect(vm.perDaySub).toBe(`${balanceF} until payday, with nothing committed against it`);
      for (const copy of [vm.heroSub, vm.perDaySub]) {
        expect(copy).not.toContain('bill');
        expect(copy).not.toContain('goal');
      }
    }
  });

  it('blames only the bills when the goals are gone', () => {
    // Demo bills, no goals, a balance that clears them with $5.51 to spare —
    // enough to stay out of the crunch arm, not enough to be a day's pace.
    const state = demoData(TODAY);
    state.goals = [];
    state.profile.primaryBalance = 1290;
    const vm = buildViewModel(state, TODAY);
    expect(vm.runway.safe).toBeGreaterThanOrEqual(0);
    expect(vm.runway.effectivePerDay).toBe(0);
    expect(vm.heroSub).toBe('nothing left over after bills');
    expect(vm.perDaySub).toBe('nothing left over after bills');
  });

  it('blames only the set-asides when the bills are gone', () => {
    const state = demoData(TODAY);
    state.bills = [];
    state.profile.primaryBalance = 130;
    const vm = buildViewModel(state, TODAY);
    expect(vm.runway.setAside).toBe(126);
    expect(vm.runway.billsDueBeforePayday).toBe(0);
    expect(vm.runway.effectivePerDay).toBe(0);
    expect(vm.heroSub).toBe('nothing left over after set-asides');
    expect(vm.perDaySub).toBe('nothing left over after set-asides');
  });

  it('keeps the shipped copy when both bills and goals exist', () => {
    // The one state the old string was actually written for. It has to survive
    // the split byte-for-byte, or #153 traded one wrong sentence for another.
    const state = demoData(TODAY);
    state.profile.primaryBalance = 1415;
    const vm = buildViewModel(state, TODAY);
    expect(vm.runway.safe).toBeGreaterThanOrEqual(0);
    expect(vm.runway.effectivePerDay).toBe(0);
    expect(vm.heroSub).toBe('nothing left over after bills & goals');
    expect(vm.perDaySub).toBe('nothing left over after bills & goals');
  });

  it('still finds the bills when the sustainable term is the binding one', () => {
    // The other half of the classifier: here the balance is healthy and it is
    // the paycheck that runs out, so `billsDueBeforePayday` is the wrong term
    // to read — the monthly bills have to be recovered from `cycleSurplus` by
    // subtraction. A wage that clears the commitments by $7.72 a cycle is not
    // over-committed, but it is not a dollar a day either.
    const state = demoData(TODAY);
    state.profile.payAmount = 730;
    const vm = buildViewModel(state, TODAY);
    expect(vm.runway.overCommitted).toBe(false);
    expect(vm.runway.sustainablePerDay).toBe(0);
    expect(vm.runway.thisCyclePerDay).toBeGreaterThan(0);
    expect(vm.heroSub).toBe('nothing left over after bills & goals');
    expect(vm.perDaySub).toBe('nothing left over after bills & goals');
  });

  it('blames the missing paycheck ahead of the goals it cannot fund', () => {
    // Bills and goals intact, wage zeroed: overCommitted is true, but telling
    // this user to stretch a goal timeline would be advice they cannot act on.
    const state = demoData(TODAY);
    state.profile.payAmount = 0;
    const vm = buildViewModel(state, TODAY);
    expect(vm.runway.overCommitted).toBe(true);
    expect(vm.runway.safe).toBeGreaterThan(0);
    expect(vm.heroSub).toBe('no paycheck on record — add what lands on payday in Settings');
    expect(vm.perDaySub).toBe('no paycheck on record — add one in Settings');
  });
});
