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

  it('says nothing is left over when the pace is zero but income exists', () => {
    // $10 a cycle floors to $0/day: honest, but not caused by a missing wage.
    const vm = buildViewModel(bareState(10), TODAY);
    expect(vm.perDayF).toBe('$0');
    expect(vm.heroColor).toBe('#e58c5b');
    expect(vm.perDayColor).toBe('#c2542a');
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
