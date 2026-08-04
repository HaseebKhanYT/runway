import {describe, expect, it} from 'vitest';
import {
  goalBarSplit,
  goalBehind,
  goalChecks,
  goalDays,
  goalPerPaycheck,
  goalPerMonth,
  goalRemaining,
  perPaycheckFor,
  round2,
  spareMonthly,
} from '../src/goals';
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
    earnMonthly: 0,
    ...partial,
  };
}

describe('goalRemaining', () => {
  it('is target minus saved, floored at zero', () => {
    expect(goalRemaining(makeGoal({}))).toBe(600);
    expect(goalRemaining(makeGoal({saved: 1200}))).toBe(0);
  });
});

describe('goalPerPaycheck', () => {
  it('uses planned per when no due date', () => {
    expect(goalPerPaycheck(makeGoal({}), 'biweekly', TODAY)).toBe(40);
  });
  it('is zero when fully funded', () => {
    expect(goalPerPaycheck(makeGoal({saved: 1000}), 'biweekly', TODAY)).toBe(0);
  });
  it('spreads remaining over remaining paychecks when due', () => {
    // 280 days out -> checks = floor(280/14) = 20; remaining 1540 -> ceil(1540/20) = 77
    const goal = makeGoal({target: 2400, saved: 860, per: 85, due: '2027-04-22'});
    expect(goalDays(goal, TODAY)).toBe(280);
    expect(goalChecks(goal, 'biweekly', TODAY)).toBe(20);
    expect(goalPerPaycheck(goal, 'biweekly', TODAY)).toBe(77);
  });
});

describe('goalPerMonth', () => {
  it('converts cadence per to monthly when no due date', () => {
    // ceil(40 * 30.44/14) = ceil(86.97) = 87
    expect(goalPerMonth(makeGoal({}), 'biweekly', TODAY)).toBe(87);
  });
  it('leaves a monthly per alone — one paycheck a month is one', () => {
    // Scaling by 30.44/30 used to round this up to 41.
    expect(goalPerMonth(makeGoal({}), 'monthly', TODAY)).toBe(40);
    expect(goalPerMonth(makeGoal({}), 'semimonthly', TODAY)).toBe(80);
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

describe('perPaycheckFor', () => {
  it('counts the paychecks before the due date, not two per month', () => {
    // A two-month plan begun on 16 July is due 1 September — 47 days, so
    // three biweekly paychecks land before it, not the four that "2 × 2"
    // assumes. $2,667 is what the runway will charge; $2,000 is the figure
    // that used to be written down beside it.
    expect(perPaycheckFor(8000, '2026-09-01', 'biweekly', TODAY)).toBe(2667);
    expect(perPaycheckFor(8000, '2026-09-01', 'weekly', TODAY)).toBe(1334);
  });

  it('agrees with what the runway reads back, so a plan cannot open behind', () => {
    const due = '2026-09-01';
    const per = perPaycheckFor(8000, due, 'biweekly', TODAY);
    const goal = makeGoal({target: 8000, saved: 0, per, due});
    expect(goalPerPaycheck(goal, 'biweekly', TODAY)).toBe(per);
    expect(goalBehind(goal, 'biweekly', TODAY)).toBe(false);
    // The old arithmetic, for contrast: same goal, `months × 2` per.
    expect(goalBehind(makeGoal({target: 8000, saved: 0, per: 2000, due}), 'biweekly', TODAY)).toBe(
      true,
    );
  });

  it('never asks for more than is left, however close the due date', () => {
    expect(perPaycheckFor(300, '2026-07-17', 'biweekly', TODAY)).toBe(300);
    expect(perPaycheckFor(0, '2027-07-17', 'biweekly', TODAY)).toBe(0);
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
  it('is the surplus itself for a monthly earner', () => {
    // The month and the cycle are the same span, so there is nothing to
    // scale. Dividing 30.44 by 30 used to inflate this to 1010.
    expect(spareMonthly(1000, 'monthly')).toBe(1000);
    expect(spareMonthly(1000, 'semimonthly')).toBe(2000);
  });
});
