import {describe, expect, it} from 'vitest';
import {
  goalBarSplit,
  goalBehind,
  goalChecks,
  goalDays,
  goalPer,
  goalPerMonth,
  goalRemaining,
  round2,
  spareMonthly,
} from '../src/goal_math';
import type {Goal} from '../src/types';

const TODAY = new Date('2026-07-16T12:00:00');

describe('round2', () => {
  it('rounds to cents', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1540.004)).toBe(1540);
  });
});

function makeGoal(partial: Partial<Goal>): Goal {
  return {
    id: 'g1',
    name: 'Test goal',
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
    ...partial,
  };
}

describe('goalRemaining', () => {
  it('is target minus saved, floored at zero', () => {
    expect(goalRemaining(makeGoal({}))).toBe(600);
    expect(goalRemaining(makeGoal({saved: 1200}))).toBe(0);
  });
});

describe('goalPer', () => {
  it('uses planned per when no due date', () => {
    expect(goalPer(makeGoal({}), 'biweekly', TODAY)).toBe(40);
  });
  it('is zero when fully funded', () => {
    expect(goalPer(makeGoal({saved: 1000}), 'biweekly', TODAY)).toBe(0);
  });
  it('spreads remaining over remaining paychecks when due', () => {
    // 280 days out -> checks = floor(280/14) = 20; remaining 1540 -> ceil(1540/20) = 77
    const goal = makeGoal({target: 2400, saved: 860, per: 85, due: '2027-04-22'});
    expect(goalDays(goal, TODAY)).toBe(280);
    expect(goalChecks(goal, 'biweekly', TODAY)).toBe(20);
    expect(goalPer(goal, 'biweekly', TODAY)).toBe(77);
  });
});

describe('goalPerMonth', () => {
  it('converts cadence per to monthly when no due date', () => {
    // ceil(40 * 30.44/14) = ceil(86.97) = 87
    expect(goalPerMonth(makeGoal({}), 'biweekly', TODAY)).toBe(87);
  });
  it('spreads remaining over months when due', () => {
    // 280 days -> months = floor(280/30.44) = 9; ceil(1540/9) = 172
    const goal = makeGoal({target: 2400, saved: 860, due: '2027-04-22'});
    expect(goalPerMonth(goal, 'biweekly', TODAY)).toBe(172);
  });
});

describe('goalBehind', () => {
  it('falls back to stored flag without due/per', () => {
    expect(goalBehind(makeGoal({behind: true, per: 0}), 'biweekly', TODAY)).toBe(true);
  });
  it('is behind when required per exceeds planned per', () => {
    // required ceil(1540/20)=77 > per 50 + 0.5
    const goal = makeGoal({target: 2400, saved: 860, per: 50, due: '2027-04-22'});
    expect(goalBehind(goal, 'biweekly', TODAY)).toBe(true);
  });
  it('never behind when funded', () => {
    expect(goalBehind(makeGoal({saved: 1000, behind: true}), 'biweekly', TODAY)).toBe(false);
  });
});

describe('goalBarSplit', () => {
  it('splits financed vs paycheck portions', () => {
    const goal = makeGoal({target: 1000, saved: 500, financed: 300});
    expect(goalBarSplit(goal)).toEqual({finPct: 30, payPct: 20});
  });
});

describe('spareMonthly', () => {
  it('scales cycle surplus to a month, nearest $10', () => {
    // 978.7 * 30.44/14 / 10 -> round(212.79) * 10 = 2130
    expect(spareMonthly(978.7, 'biweekly')).toBe(2130);
  });
});
