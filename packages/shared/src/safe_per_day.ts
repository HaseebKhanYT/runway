import {cycleDays, DAYS_PER_MONTH, daysUntil} from './cycles';
import {goalPer} from './goal_math';
import {pooledBalance, type AppState, type Goal} from './types';

export interface RunwaySummary {
  CYCLE: number;
  /** Days until the next paycheck, clamped to [1, CYCLE]. */
  DAYS: number;
  preBillsSum: number;
  setAside: number;
  /** balance − bills due before payday − goal set-asides. */
  safe: number;
  /** Signed daily figure for this cycle alone. */
  perDay: number;
  /** What every future cycle can afford per day. */
  sustainDay: number;
  /** The number on screen: min(perDay, sustainDay). */
  effDay: number;
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
  const CYCLE = cycleDays(cadence);

  let DAYS: number = CYCLE;
  if (state.profile.nextPay) {
    const d = daysUntil(state.profile.nextPay, today);
    if (Number.isFinite(d)) DAYS = Math.max(1, Math.min(CYCLE, d));
  }

  const unpaidBills = state.bills.filter((b) => !b.paid);
  // Only bills due BEFORE the next paycheck come out of today's balance;
  // anything due on/after payday is covered by that incoming check.
  const preBills = unpaidBills.filter((b) => b.off < DAYS);
  const preBillsSum = preBills.reduce((sum, b) => sum + b.amount, 0);

  const setAside = activeGoals(state.goals).reduce(
    (sum, g) => sum + goalPer(g, cadence, today),
    0,
  );

  const balance = pooledBalance(state);
  const safe = balance - preBillsSum - setAside;
  const perDay = safe < 0 ? -Math.ceil(-safe / DAYS) : Math.floor(safe / DAYS);

  // Sustainability — what every future cycle can afford, not just this one.
  const payAmt = state.profile.payAmount;
  const billsMonthly = state.bills
    .filter((b) => !b.oneTime && !b.personal)
    .reduce((sum, b) => sum + (b.cycle === 'yearly' ? b.amount / 12 : b.amount), 0);
  const billsPerCycle = (billsMonthly * CYCLE) / DAYS_PER_MONTH;
  const cycleSurplus = payAmt - billsPerCycle - setAside;
  const sustainDay =
    cycleSurplus < 0 ? -Math.ceil(-cycleSurplus / CYCLE) : Math.floor(cycleSurplus / CYCLE);

  const effDay = Math.min(perDay, sustainDay);
  return {
    CYCLE,
    DAYS,
    preBillsSum,
    setAside,
    safe,
    perDay,
    sustainDay,
    effDay,
    squeezed: sustainDay < perDay,
    overCommitted: cycleSurplus < 0,
    cycleSurplus,
  };
}
