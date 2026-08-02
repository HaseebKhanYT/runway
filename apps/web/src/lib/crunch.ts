import {
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
  short: number;
  /** Which bill breaks the balance, or the set-asides line. */
  billLine: string;
  goalLevers: CrunchGoalLever[];
  cardLevers: CrunchCardLever[];
  freed: number;
  rem: number;
  advance: number;
  covered: boolean;
  gapLine: string;
  gapColor: string;
}

function breakingBill(state: AppState, runway: RunwaySummary, today: Date): Bill | null {
  let run = pooledBalance(state);
  const preBills = state.bills
    .filter((b) => !b.paid && b.off < runway.DAYS)
    .sort((a, b) => a.off - b.off);
  for (const b of preBills) {
    run -= b.amount;
    if (run < 0) return b;
  }
  void today;
  return null;
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

  const bill = on ? breakingBill(state, runway, today) : null;
  const billLine = bill
    ? `Not enough for ${bill.name} (${formatMoney(bill.amount)}, due ${formatShortDate(bill.off, today)})`
    : 'Your set-asides put you under for this cycle';

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
      const eff = effectiveApr(c, today);
      const isPromo = eff === 0;
      const interest = Math.max(1, Math.round((advance * c.apr) / 1200));
      return {
        card: c,
        title: `Cover the rest with ${c.name} · ${isPromo ? '0% promo' : `${c.apr}% APR`}`,
        sub: isPromo
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
    short,
    billLine,
    goalLevers,
    cardLevers,
    freed,
    rem,
    advance,
    covered,
    gapLine,
    gapColor: covered ? '#7fc79b' : '#e58b6b',
  };
}
