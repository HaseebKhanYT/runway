import {
  computeRunway,
  goalPerPaycheck,
  pooledBalance,
  type AppState,
  type RunwaySummary,
} from '@runway/shared';
import {formatShortDate, formatDayAmount, formatMoney} from './format';

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

  const {
    safe,
    effectivePerDay,
    thisCyclePerDay,
    squeezed,
    overCommitted,
    daysToPayday,
    cycleSurplus,
  } = runway;

  const heroLabel = 'YOURS TO SPEND, EVERY DAY';
  const heroNumber = formatDayAmount(effectivePerDay) + '/day';
  const heroColor = safe < 0 || overCommitted ? '#e58c5b' : '#f6f0e6';
  let heroSub: string;
  if (safe < 0) {
    heroSub = "bills due before payday exceed your balance — let's look at the runway";
  } else if (overCommitted) {
    heroSub = `your goals + bills need ${formatMoney(-cycleSurplus)} more than each paycheck brings in — stretch a goal timeline`;
  } else if (squeezed) {
    heroSub = `a pace that still works after payday — this cycle alone would allow ${formatDayAmount(thisCyclePerDay)}/day`;
  } else {
    heroSub = 'after bills & goals';
  }

  let perDaySub: string;
  if (effectivePerDay >= 0) {
    perDaySub = 'a pace that lasts past payday';
  } else if (safe < 0) {
    perDaySub = `${formatMoney(-safe)} short before payday — trim a bill or stretch a goal`;
  } else {
    perDaySub = `${formatMoney(-cycleSurplus)} short each paycheck — trim a bill or stretch a goal`;
  }

  const setAside = state.goals
    .filter((g) => g.saved < g.target && !g.paused)
    .reduce((sum, g) => sum + goalPerPaycheck(g, cadence, today), 0);

  const extraCount = state.accounts.length;

  return {
    runway,
    balance,
    balanceF: formatMoney(balance),
    todayLabel: today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    todayShort: formatShortDate(0, today),
    daysToPay: daysToPayday,
    acctChipTag: extraCount === 0 ? '▾' : `· ${extraCount + 1}`,
    heroLabel,
    heroNumber,
    heroSub,
    heroColor,
    perDayF: formatDayAmount(effectivePerDay),
    perDaySub,
    perDayColor: effectivePerDay < 0 ? '#c2542a' : '#29221a',
    paydayLabel: formatShortDate(daysToPayday, today),
    payAmountF: formatMoney(state.profile.payAmount),
    setAsideF: formatMoney(setAside),
    unpaidBillCount: state.bills.filter((b) => !b.paid).length,
  };
}
