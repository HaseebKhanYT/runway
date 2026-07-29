import {cycleDays, DAYS_PER_MONTH, daysUntil, type Cadence} from './cycles';
import {round2} from './money';
import type {Goal} from './types';

export function goalRemaining(g: Goal): number {
  return Math.max(0, round2(g.target - g.saved));
}

/** Days until the goal's due date, or null when open-ended. */
export function goalDays(g: Goal, today: Date): number | null {
  if (!g.due) return null;
  return Math.max(0, daysUntil(g.due, today));
}

/** Paychecks left before the due date, or null when open-ended. */
export function goalChecks(g: Goal, cadence: Cadence, today: Date): number | null {
  const days = goalDays(g, today);
  if (days == null) return null;
  return Math.max(1, Math.floor(days / cycleDays(cadence)));
}

/** Live per-paycheck set-aside: what's left over the paychecks left. */
export function goalPer(g: Goal, cadence: Cadence, today: Date): number {
  const remaining = goalRemaining(g);
  if (remaining <= 0) return 0;
  if (!g.due) return g.per || 0;
  const checks = goalChecks(g, cadence, today) ?? 1;
  return Math.min(remaining, Math.ceil(remaining / checks));
}

/** What the goal demands per calendar month — independent of pay cadence. */
export function goalPerMonth(g: Goal, cadence: Cadence, today: Date): number {
  const remaining = goalRemaining(g);
  if (remaining <= 0) return 0;
  const days = goalDays(g, today);
  if (days == null) {
    return Math.min(remaining, Math.ceil((g.per || 0) * (DAYS_PER_MONTH / cycleDays(cadence))));
  }
  const months = Math.max(1, Math.floor(days / DAYS_PER_MONTH));
  return Math.min(remaining, Math.ceil(remaining / months));
}

/** Behind = the planned rate won't hit the target by the due date. */
export function goalBehind(g: Goal, cadence: Cadence, today: Date): boolean {
  if (g.saved >= g.target) return false;
  if (!g.due || !g.per) return !!g.behind;
  const checks = goalChecks(g, cadence, today) ?? 1;
  return Math.ceil(goalRemaining(g) / checks) > g.per + 0.5;
}

/** Progress-bar split between card-financed and paycheck-saved portions. */
export function goalBarSplit(g: Goal): {finPct: number; payPct: number} {
  const finPart = Math.min(g.financed || 0, g.saved);
  const payPart = Math.max(0, g.saved - finPart);
  const finPct = Math.min(100, (finPart / g.target) * 100);
  const payPct = Math.min(Math.max((payPart / g.target) * 100, 0), 100 - finPct);
  return {finPct, payPct};
}

/** Monthly spare from the cycle surplus, rounded to the nearest $10. */
export function spareMonthly(cycleSurplus: number, cadence: Cadence): number {
  return Math.round((cycleSurplus * DAYS_PER_MONTH) / cycleDays(cadence) / 10) * 10;
}
