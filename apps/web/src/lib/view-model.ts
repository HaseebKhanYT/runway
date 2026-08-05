import {
  computeRunway,
  goalPerPaycheck,
  paydayOffset,
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
  paydayChip: string;
  payAmountF: string;
  setAsideF: string;
  unpaidBillCount: number;
}

/** Which term held the pace at exactly zero (#153). */
type StallCause = {kind: 'balance'} | {kind: 'paycheck'} | {kind: 'commitments'; phrase: string};

/**
 * Classify a zero pace. Only sound inside the `stalled` arm — by then the
 * earlier arms have excluded `safe < 0`, `payAmount <= 0` and `cycleSurplus < 0`,
 * so both per-day figures are `>= 0` and `effectivePerDay` is exactly 0.
 *
 * `crunch.ts`'s `crunchCause` is not reused. It is documented as valid only
 * where `safe < 0`, and that precondition is what makes its final arm sound: at
 * `safe === 0` with no bills and no goals it still returns `setAside`, which is
 * the #90 bug relocated rather than fixed. This is the `safe >= 0` twin, and it
 * asks a different question — `effectivePerDay` is a `min` of two terms, so the
 * honest cause is whichever term binds, and only then which of its inputs
 * actually exists.
 */
function classifyStall(runway: RunwaySummary, payAmount: number): StallCause {
  const {thisCyclePerDay, sustainablePerDay, billsDueBeforePayday, setAside, cycleSurplus} = runway;
  const thisCycleBinds = thisCyclePerDay <= sustainablePerDay;
  // `computeRunway` does not carry `billsPerCycle` out, so the sustainable arm
  // has to recover it by subtraction — and subtracting floats leaves ~1e-13 of
  // residue on a profile that has no bills at all. Half a cent is below
  // anything the UI can render and far above anything the subtraction invents,
  // so it separates a real bill from arithmetic noise.
  const hasBills = thisCycleBinds
    ? billsDueBeforePayday > 0
    : payAmount - cycleSurplus - setAside > 0.005;
  const hasGoals = setAside > 0;
  if (!hasBills && !hasGoals) {
    // Nothing is committed, so the binding term is the whole story: this cycle
    // binding means the balance cannot reach payday, the other means one
    // paycheck cannot.
    return thisCycleBinds ? {kind: 'balance'} : {kind: 'paycheck'};
  }
  // Name only what exists. The both-ways phrase is byte-for-byte the string
  // this arm has always printed — that case was the one it was written for.
  return {
    kind: 'commitments',
    phrase: hasBills && hasGoals ? 'bills & goals' : hasBills ? 'bills' : 'set-asides',
  };
}

function stallHeroSub(cause: StallCause, balanceF: string, payAmountF: string): string {
  switch (cause.kind) {
    case 'balance':
      return `${balanceF} is all there is until payday — nothing is committed against it`;
    case 'paycheck':
      return `${payAmountF} a paycheck does not stretch to a dollar a day`;
    case 'commitments':
      return `nothing left over after ${cause.phrase}`;
  }
}

function stallPerDaySub(cause: StallCause, balanceF: string, payAmountF: string): string {
  switch (cause.kind) {
    case 'balance':
      return `${balanceF} until payday, with nothing committed against it`;
    case 'paycheck':
      return `${payAmountF} a paycheck does not stretch to a dollar a day`;
    case 'commitments':
      return `nothing left over after ${cause.phrase}`;
  }
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

  // The date on the dashboard is a calendar question, not the divisor one:
  // `daysToPayday` is floored to 1, so on an unconfirmed payday it names
  // tomorrow. Mirror `computeRunway` when no date is stored — there the cycle
  // length is the only answer either question has.
  const paydayOff = state.profile.nextPay
    ? paydayOffset(state.profile.nextPay, cadence, today)
    : daysToPayday;

  // A paycheck of zero is a storable fact — someone between jobs has no income
  // to record — so the dashboard has to be able to name it as the reason the
  // per-day figure collapsed, rather than leaving the user to guess.
  const noIncome = state.profile.payAmount <= 0;
  // Zero per day is not a pace anyone can keep. It gets the same treatment as
  // a negative one, in the colour and in the copy.
  const stalled = effectivePerDay <= 0;
  // Computed unconditionally because both subtitle chains need it and the
  // arithmetic is free; it is read only from the arms where it is sound.
  const stallCause = classifyStall(runway, state.profile.payAmount);
  const balanceF = formatMoney(balance);
  const payAmountF = formatMoney(state.profile.payAmount);

  const heroLabel = 'YOURS TO SPEND, EVERY DAY';
  const heroNumber = formatDayAmount(effectivePerDay) + '/day';
  const heroColor = safe < 0 || overCommitted || stalled ? '#e58c5b' : '#f6f0e6';
  let heroSub: string;
  if (safe < 0) {
    heroSub = "bills due before payday exceed your balance — let's look at the runway";
  } else if (noIncome) {
    heroSub = 'no paycheck on record — add what lands on payday in Settings';
  } else if (overCommitted) {
    heroSub = `your goals + bills need ${formatMoney(-cycleSurplus)} more than each paycheck brings in — stretch a goal timeline`;
  } else if (stalled) {
    heroSub = stallHeroSub(stallCause, balanceF, payAmountF);
  } else if (squeezed) {
    heroSub = `a pace that still works after payday — this cycle alone would allow ${formatDayAmount(thisCyclePerDay)}/day`;
  } else {
    heroSub = 'after bills & goals';
  }

  let perDaySub: string;
  if (effectivePerDay > 0) {
    perDaySub = 'a pace that lasts past payday';
  } else if (safe < 0) {
    perDaySub = `${formatMoney(-safe)} short before payday — trim a bill or stretch a goal`;
  } else if (noIncome) {
    perDaySub = 'no paycheck on record — add one in Settings';
  } else if (overCommitted) {
    perDaySub = `${formatMoney(-cycleSurplus)} short each paycheck — trim a bill or stretch a goal`;
  } else {
    perDaySub = stallPerDaySub(stallCause, balanceF, payAmountF);
  }

  const setAside = state.goals
    .filter((g) => g.saved < g.target && !g.paused)
    .reduce((sum, g) => sum + goalPerPaycheck(g, cadence, today), 0);

  const extraCount = state.accounts.length;

  return {
    runway,
    balance,
    balanceF,
    todayLabel: today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    todayShort: formatShortDate(0, today),
    daysToPay: paydayOff,
    acctChipTag: extraCount === 0 ? '▾' : `· ${extraCount + 1}`,
    heroLabel,
    heroNumber,
    heroSub,
    heroColor,
    perDayF: formatDayAmount(effectivePerDay),
    perDaySub,
    perDayColor: stalled ? '#c2542a' : '#29221a',
    paydayLabel: formatShortDate(paydayOff, today),
    // The chip's wording is built here rather than in the shell because
    // `payday in 0d` is not a phrase, and `apps/web` has no component test
    // harness — this is the only place a test can read the string.
    paydayChip: paydayOff === 0 ? 'payday today' : `payday in ${paydayOff}d`,
    payAmountF,
    setAsideF: formatMoney(setAside),
    unpaidBillCount: state.bills.filter((b) => !b.paid).length,
  };
}
