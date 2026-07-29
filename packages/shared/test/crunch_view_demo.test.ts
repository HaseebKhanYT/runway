import {describe, expect, it} from 'vitest';
import {computeCrunch} from '../src/crunch_math';
import {demoData} from '../src/demo_data';
import {computeRunway} from '../src/safe_per_day';
import {buildViewModel} from '../src/view_model';
import type {AppState} from '../src/types';

const TODAY = new Date('2026-07-16T12:00:00');

function crunchState(): AppState {
  const state = demoData(TODAY);
  state.profile.primaryBalance = 500;
  return state;
}

describe('demoData', () => {
  it('matches the catalog seed', () => {
    const state = demoData(TODAY);
    expect(state.bills).toHaveLength(7);
    expect(state.cats).toHaveLength(6);
    expect(state.txns).toHaveLength(14);
    expect(state.goals).toHaveLength(2);
    expect(state.cards).toHaveLength(2);
    expect(state.profile.primaryBalance).toBe(6000);
    expect(state.profile.payAmount).toBe(1700);
    expect(state.cats.find((c) => c.locked)?.name).toBe('Uncategorized');
    expect(state.bills.find((b) => b.id === 'spotify')?.paid).toBe(true);
  });
});

describe('buildViewModel', () => {
  it('renders squeezed hero for the demo seed', () => {
    const vm = buildViewModel(demoData(TODAY), TODAY);
    // preBills: rent 950 + electric 74 + phone 45 + carda 160 + netflix 15.49 + gym 40 = 1284.49
    expect(vm.runway.preBillsSum).toBeCloseTo(1284.49);
    // setAside: japan per (due 2027-04-01, 259 days, 18 checks -> ceil(1540/18)=86) + efund 40
    expect(vm.runway.setAside).toBe(126);
    expect(vm.runway.safe).toBeCloseTo(4589.51);
    expect(vm.runway.squeezed).toBe(true);
    expect(vm.heroSub).toContain('a pace that still works after payday');
    expect(vm.perDaySub).toBe('a pace that lasts past payday');
    expect(vm.unpaidBillCount).toBe(6);
    expect(vm.acctChipTag).toBe('▾');
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

describe('computeCrunch', () => {
  it('identifies the breaking bill and orders levers cheapest first', () => {
    const state = crunchState();
    const runway = computeRunway(state, TODAY);
    const crunch = computeCrunch(state, runway, {pausedGoalIds: [], cardId: null}, TODAY);
    expect(crunch.on).toBe(true);
    expect(crunch.billLine).toBe('Not enough for Rent ($950.00, due Jul 19)');
    expect(crunch.goalLevers.map((l) => l.goal.id)).toEqual(['japan', 'efund']);
    // Card B has 0% promo -> sorts before Card A
    expect(crunch.cardLevers.map((l) => l.card.id)).toEqual(['cardb', 'carda']);
    expect(crunch.covered).toBe(false);
  });

  it('covers when levers stack past the shortfall', () => {
    const state = crunchState();
    const runway = computeRunway(state, TODAY);
    const crunch = computeCrunch(
      state,
      runway,
      {pausedGoalIds: ['japan', 'efund'], cardId: 'cardb'},
      TODAY,
    );
    expect(crunch.covered).toBe(true);
    expect(crunch.gapLine).toMatch(/^Covered ✓ · /);
    expect(crunch.gapColor).toBe('#7fc79b');
  });
});
