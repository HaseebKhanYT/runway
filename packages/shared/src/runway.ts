import {cycleDays, DAYS_PER_MONTH, daysToNextPayday} from './cycles';
import {goalPerPaycheck} from './goals';
import {type AppState, type Goal} from './types';

/** Everything spendable — the total that drives the runway. */
export function pooledBalance(state: AppState): number {
  return state.profile.primaryBalance + state.accounts.reduce((sum, a) => sum + a.balance, 0);
}

export interface RunwaySummary {
  cycleLength: number;
  /** Days until the next paycheck — at least 1, and never clamped downwards. */
  daysToPayday: number;
  billsDueBeforePayday: number;
  setAside: number;
  /** balance − bills due before payday − goal set-asides. */
  safe: number;
  /** Signed daily figure for this cycle alone. */
  thisCyclePerDay: number;
  /** What every future cycle can afford per day. */
  sustainablePerDay: number;
  /** The number on screen: min(thisCyclePerDay, sustainablePerDay). */
  effectivePerDay: number;
  squeezed: boolean;
  overCommitted: boolean;
  cycleSurplus: number;
}

function activeGoals(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.saved < g.target && !g.paused);
}

/** The core formula (catalog §3.3), ported 1:1 from the design. */
export function computeRunway(state: AppState, today: Date): RunwaySummary {
  const cadence = state.profile.cadence || 'biweekly';
  const cycleLength = cycleDays(cadence);

  const daysToPayday: number = state.profile.nextPay
    ? daysToNextPayday(state.profile.nextPay, cadence, today)
    : cycleLength;

  const unpaidBills = state.bills.filter((b) => !b.paid);
  // Only bills due BEFORE the next paycheck come out of today's balance;
  // anything due on/after payday is covered by that incoming check.
  const preBills = unpaidBills.filter((b) => b.off < daysToPayday);
  const billsDueBeforePayday = preBills.reduce((sum, b) => sum + b.amount, 0);

  const setAside = activeGoals(state.goals).reduce(
    (sum, g) => sum + goalPerPaycheck(g, cadence, today),
    0,
  );

  const balance = pooledBalance(state);
  const safe = balance - billsDueBeforePayday - setAside;
  const thisCyclePerDay =
    safe < 0 ? -Math.ceil(-safe / daysToPayday) : Math.floor(safe / daysToPayday);

  // Sustainability — what every future cycle can afford, not just this one.
  const payAmt = state.profile.payAmount;
  const billsMonthly = state.bills
    .filter((b) => !b.oneTime && !b.personal)
    .reduce((sum, b) => sum + (b.cycle === 'yearly' ? b.amount / 12 : b.amount), 0);
  const billsPerCycle = (billsMonthly * cycleLength) / DAYS_PER_MONTH;
  const cycleSurplus = payAmt - billsPerCycle - setAside;
  const sustainablePerDay =
    cycleSurplus < 0
      ? -Math.ceil(-cycleSurplus / cycleLength)
      : Math.floor(cycleSurplus / cycleLength);

  const effectivePerDay = Math.min(thisCyclePerDay, sustainablePerDay);
  return {
    cycleLength,
    daysToPayday,
    billsDueBeforePayday,
    setAside,
    safe,
    thisCyclePerDay,
    sustainablePerDay,
    effectivePerDay,
    squeezed: sustainablePerDay < thisCyclePerDay,
    overCommitted: cycleSurplus < 0,
    cycleSurplus,
  };
}
