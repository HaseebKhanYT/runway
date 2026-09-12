import {demoData, type AppState} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {moneySignature, safeToSpendAnnouncement} from '../src/lib/announcement';
import {buildViewModel} from '../src/lib/view-model';

const TODAY = new Date('2026-07-16T12:00:00');

/** Bills due before payday exceed the balance — the crunch copy. */
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

describe('safeToSpendAnnouncement', () => {
  it('names the seed figure and the pace behind it', () => {
    const vm = buildViewModel(demoData(TODAY), TODAY);
    expect(safeToSpendAnnouncement(vm)).toBe(
      '$69 a day safe to spend — a pace that lasts past payday',
    );
  });

  it('speaks the same figure the sidebar tile renders', () => {
    // The tile prints `vm.perDayF` bare. If the spoken figure were derived
    // anywhere else, a screen reader user and a sighted user would be reading
    // two different numbers off the same screen.
    for (const state of [demoData(TODAY), crunchState(), bareState(0), bareState(10)]) {
      const vm = buildViewModel(state, TODAY);
      expect(safeToSpendAnnouncement(vm)).toContain(vm.perDayF);
      expect(safeToSpendAnnouncement(vm).startsWith(`${vm.perDayF} a day safe to spend`)).toBe(
        true,
      );
    }
  });

  it('carries the no-paycheck tail when there is no income on record', () => {
    const vm = buildViewModel(bareState(0), TODAY);
    expect(vm.perDaySub).toBe('no paycheck on record — add one in Settings');
    expect(safeToSpendAnnouncement(vm)).toBe(
      '$0 a day safe to spend — no paycheck on record — add one in Settings',
    );
  });

  it('carries the shortfall tail in a crunch', () => {
    const vm = buildViewModel(crunchState(), TODAY);
    expect(vm.runway.safe).toBeLessThan(0);
    expect(safeToSpendAnnouncement(vm)).toBe(`${vm.perDayF} a day safe to spend — ${vm.perDaySub}`);
    expect(safeToSpendAnnouncement(vm)).toContain('short before payday');
  });
});

describe('moneySignature', () => {
  it('ignores a rename but catches a spend the headline figure hides', () => {
    // The pairing is the point. Every mutating endpoint returns a fresh
    // AppState, so the signature has to be narrow enough to stay quiet for a
    // rename and wide enough to notice money the per-day figure does not
    // record.
    const base = buildViewModel(demoData(TODAY), TODAY);

    const renamed = demoData(TODAY);
    renamed.cats[0].name = 'Groceries & household';
    expect(moneySignature(buildViewModel(renamed, TODAY))).toBe(moneySignature(base));

    // $200 off a $6,000 balance. `effectivePerDay` is min(cycle, sustainable)
    // and the seed is bound by the sustainable term, so the headline figure
    // does not budge — this is the issue's own reproduction.
    const spent = demoData(TODAY);
    spent.profile.primaryBalance -= 200;
    const afterSpend = buildViewModel(spent, TODAY);
    expect(afterSpend.perDayF).toBe(base.perDayF);
    expect(afterSpend.balanceF).not.toBe(base.balanceF);
    expect(moneySignature(afterSpend)).not.toBe(moneySignature(base));
  });

  it('changes when the per-day figure itself moves', () => {
    const base = buildViewModel(demoData(TODAY), TODAY);
    const raised = demoData(TODAY);
    raised.profile.payAmount += 500;
    const vm = buildViewModel(raised, TODAY);
    expect(vm.perDayF).not.toBe(base.perDayF);
    expect(moneySignature(vm)).not.toBe(moneySignature(base));
  });
});
