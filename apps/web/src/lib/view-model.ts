import {
  computeRunway,
  d,
  dayF,
  fm,
  goalPer,
  pooledBalance,
  type AppState,
  type RunwaySummary,
} from '@runway/shared';

export type View = 'runway' | 'bills' | 'goals' | 'activity' | 'cards' | 'settings';

export const PAGE_TITLES: Record<View, string> = {
  runway: 'Your runway',
  bills: 'Bills to pay',
  goals: 'Big things',
  activity: 'All activity',
  cards: 'Credit cards',
  settings: 'Settings',
};

export interface ViewModel {
  runway: RunwaySummary;
  balance: number;
  balanceF: string;
  todayLabel: string;
  todayShort: string;
  daysToPay: number;
  acctChipTag: string;
  heroLabel: string;
  heroNumber: string;
  heroSub: string;
  heroColor: string;
  perDayF: string;
  perDaySub: string;
  perDayColor: string;
  paydayLabel: string;
  payAmountF: string;
  setAsideF: string;
  unpaidBillCount: number;
}

/** Display strings for the shell + dashboard hero (catalog §1.0/§1.1). */
export function buildViewModel(state: AppState, today: Date): ViewModel {
  const runway = computeRunway(state, today);
  const balance = pooledBalance(state);
  const cadence = state.profile.cadence;

  const {safe, effDay, perDay, squeezed, overCommitted, DAYS, cycleSurplus} = runway;

  const heroLabel = 'YOURS TO SPEND, EVERY DAY';
  const heroNumber = dayF(effDay) + '/day';
  const heroColor = safe < 0 || overCommitted ? '#e58c5b' : '#f6f0e6';
  let heroSub: string;
  if (safe < 0) {
    heroSub = "bills due before payday exceed your balance — let's look at the runway";
  } else if (overCommitted) {
    heroSub = `your goals + bills need ${fm(-cycleSurplus)} more than each paycheck brings in — stretch a goal timeline`;
  } else if (squeezed) {
    heroSub = `a pace that still works after payday — this cycle alone would allow ${dayF(perDay)}/day`;
  } else {
    heroSub = 'after bills & goals';
  }

  let perDaySub: string;
  if (effDay >= 0) {
    perDaySub = 'a pace that lasts past payday';
  } else if (safe < 0) {
    perDaySub = `${fm(-safe)} short before payday — trim a bill or stretch a goal`;
  } else {
    perDaySub = `${fm(-cycleSurplus)} short each paycheck — trim a bill or stretch a goal`;
  }

  const setAside = state.goals
    .filter((g) => g.saved < g.target && !g.paused)
    .reduce((sum, g) => sum + goalPer(g, cadence, today), 0);

  const extraCount = state.accounts.length;

  return {
    runway,
    balance,
    balanceF: fm(balance),
    todayLabel: today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    todayShort: d(0, today),
    daysToPay: DAYS,
    acctChipTag: extraCount === 0 ? '▾' : `· ${extraCount + 1}`,
    heroLabel,
    heroNumber,
    heroSub,
    heroColor,
    perDayF: dayF(effDay),
    perDaySub,
    perDayColor: effDay < 0 ? '#c2542a' : '#29221a',
    paydayLabel: d(DAYS, today),
    payAmountF: fm(state.profile.payAmount),
    setAsideF: fm(setAside),
    unpaidBillCount: state.bills.filter((b) => !b.paid).length,
  };
}
