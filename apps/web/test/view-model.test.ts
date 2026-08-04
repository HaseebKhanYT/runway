import {demoData, type AppState} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {buildViewModel} from '../src/lib/view-model';

const TODAY = new Date('2026-07-16T12:00:00');

function crunchState(): AppState {
  const state = demoData(TODAY);
  state.profile.primaryBalance = 500;
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

  it('renders crunch state', () => {
    const vm = buildViewModel(crunchState(), TODAY);
    expect(vm.runway.safe).toBeLessThan(0);
    expect(vm.heroColor).toBe('#e58c5b');
    expect(vm.heroSub).toBe(
      "bills due before payday exceed your balance — let's look at the runway",
    );
  });
});
