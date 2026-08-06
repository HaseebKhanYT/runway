import {
  daysUntil,
  effectiveApr,
  goalPerPaycheck,
  pooledBalance,
  type AppState,
  type Bill,
  type Card,
  type Goal,
  type RunwaySummary,
} from '@runway/shared';
import {formatShortDate, formatMoney} from './format';
import {livePromo} from './promo';

export interface CrunchGoalLever {
  goal: Goal;
  /** e.g. 'Pause "Japan trip" this cycle'. */
  title: string;
  /** e.g. 'frees $85.00 · resumes automatically at payday'. */
  sub: string;
  frees: number;
}

export interface CrunchCardLever {
  card: Card;
  title: string;
  sub: string;
  headroom: number;
}

export interface CrunchSelection {
  pausedGoalIds: string[];
  cardId: string | null;
}

export interface CrunchSummary {
  on: boolean;
  shortfall: number;
  /**
   * Why the cycle is short, named after the first of `safe`'s three terms that
   * accounts for it: an already-overdrawn balance, the bill whose subtraction
   * crosses zero, or the set-asides.
   */
  billLine: string;
  goalLevers: CrunchGoalLever[];
  cardLevers: CrunchCardLever[];
  freed: number;
  remainingShort: number;
  advance: number;
  covered: boolean;
  gapLine: string;
  gapColor: string;
}

/** Which of `safe`'s three terms put this cycle under (#90). */
type CrunchCause =
  {kind: 'balance'; balance: number} | {kind: 'bill'; bill: Bill} | {kind: 'setAside'};

/**
 * Classify a shortfall. `safe` is `balance − billsDueBeforePayday − setAside`
 * and any of the three can drive it negative, so the panel has to say which
 * one did rather than assume a bill and fall back to the goals.
 *
 * Priority is the order the money is spent in. An overdrawn balance comes
 * first because the walk below starts from it: on a negative opening balance
 * the very first bill would "cross" zero and take the blame for a hole that
 * predates it.
 *
 * Only call this when `runway.safe < 0`. That is what makes the last arm
 * sound: with `balance >= 0` and no bill crossing zero, `balance − bills >= 0`,
 * so the set-asides are all that is left to have done it.
 */
function crunchCause(state: AppState, runway: RunwaySummary, today: Date): CrunchCause {
  const balance = pooledBalance(state);
  if (balance < 0) return {kind: 'balance', balance};

  let run = balance;
  // Same clock as `runway.daysToPayday` was computed against, so this walks
  // exactly the set of bills `computeRunway` subtracted.
  const preBills = state.bills
    .filter((b) => !b.paid && daysUntil(b.dueDate, today) < runway.daysToPayday)
    .sort((a, b) => daysUntil(a.dueDate, today) - daysUntil(b.dueDate, today));
  for (const b of preBills) {
    run -= b.amount;
    if (run < 0) return {kind: 'bill', bill: b};
  }
  return {kind: 'setAside'};
}

const SET_ASIDE_LINE = 'Your set-asides put you under for this cycle';

function causeLine(cause: CrunchCause, today: Date): string {
  switch (cause.kind) {
    case 'balance':
      return `Your balance is already ${formatMoney(-cause.balance)} below zero`;
    case 'bill':
      return `Not enough for ${cause.bill.name} (${formatMoney(cause.bill.amount)}, due ${formatShortDate(daysUntil(cause.bill.dueDate, today), today)})`;
    case 'setAside':
      return SET_ASIDE_LINE;
  }
}

/** Cash-crunch panel math (catalog §3.8), cheapest-first lever ordering. */
export function computeCrunch(
  state: AppState,
  runway: RunwaySummary,
  selection: CrunchSelection,
  today: Date,
): CrunchSummary {
  const on = runway.safe < 0;
  const short = on ? Math.ceil(-runway.safe) : 0;

  // Off, there is no cause to name; the field keeps the string it has always
  // carried rather than becoming a second empty state for callers to handle.
  const billLine = on ? causeLine(crunchCause(state, runway, today), today) : SET_ASIDE_LINE;

  const cadence = state.profile.cadence;
  const goalLevers: CrunchGoalLever[] = state.goals
    .filter((g) => !g.paused && g.saved < g.target && goalPerPaycheck(g, cadence, today) > 0)
    .map((g) => {
      const frees = goalPerPaycheck(g, cadence, today);
      return {
        goal: g,
        title: `Pause “${g.name}” this cycle`,
        sub: `frees ${formatMoney(frees)} · resumes automatically at payday`,
        frees,
      };
    });

  const freed = goalLevers
    .filter((l) => selection.pausedGoalIds.includes(l.goal.id))
    .reduce((sum, l) => sum + l.frees, 0);
  const rem = Math.max(0, short - freed);

  const cardLevers: CrunchCardLever[] = state.cards
    .filter((c) => Math.floor(c.limit - c.balance) > 0)
    .sort((a, b) => effectiveApr(a, today) - effectiveApr(b, today))
    .map((c) => {
      const headroom = Math.floor(c.limit - c.balance);
      const advance = Math.min(rem, headroom);
      const promo = livePromo(c, today);
      // The rate this advance would actually be billed at, which is the rate
      // the row was sorted on. Quoting `c.apr` here priced a live promotion at
      // the rate it has not reverted to yet (#25); the zero arm keeps the
      // $1/mo floor from inventing interest a 0% card cannot charge.
      const eff = promo ? promo.rate : c.apr;
      const interest = eff === 0 ? 0 : Math.max(1, Math.round((advance * eff) / 1200));
      return {
        card: c,
        title: `Cover the rest with ${c.name} · ${promo ? `${promo.rate}% promo` : `${c.apr}% APR`}`,
        sub:
          promo != null && interest === 0
            ? `≈${formatMoney(advance)} advanced · $0 interest if cleared before the promo ends`
            : `≈${formatMoney(interest)}/mo interest until you clear it`,
        headroom,
      };
    });

  const selectedCard = selection.cardId
    ? state.cards.find((c) => c.id === selection.cardId)
    : undefined;
  const advance = selectedCard
    ? Math.min(rem, Math.floor(selectedCard.limit - selectedCard.balance))
    : 0;
  const covered = on && rem - advance <= 0 && (freed > 0 || advance > 0);

  let gapLine: string;
  if (covered) {
    const parts: string[] = [];
    if (freed > 0) parts.push(`${formatMoney(freed)} from paused goals`);
    if (advance > 0 && selectedCard) parts.push(`${formatMoney(advance)} on ${selectedCard.name}`);
    gapLine = `Covered ✓ · ${parts.join(' · ')}`;
  } else {
    const still = rem - advance;
    gapLine =
      goalLevers.length + cardLevers.length > 0
        ? `Still short ${formatMoney(still)} — stack another lever`
        : `Still short ${formatMoney(still)} — log money in, or trim a bill`;
  }

  return {
    on,
    shortfall: short,
    billLine,
    goalLevers,
    cardLevers,
    freed,
    remainingShort: rem,
    advance,
    covered,
    gapLine,
    gapColor: covered ? '#7fc79b' : '#e58b6b',
  };
}
