import type {AppState} from './types';

function iso(today: Date, off: number): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + off);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function isoTime(today: Date, off: number): string {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + off).toISOString();
}

/** The design's demo dataset (catalog §3.2), anchored to `today`. */
export function demoData(today: Date): AppState {
  return {
    profile: {
      name: 'Sam Rivera',
      email: 'sam.rivera@gmail.com',
      cadence: 'biweekly',
      nextPay: iso(today, 14),
      payAmount: 1700,
      primaryName: 'Main checking',
      primaryBalance: 6000,
      primaryLogo: null,
      notifBills: true,
      notifWeekly: false,
      onboarded: true,
    },
    accounts: [],
    bills: [
      bill('rent', 'Rent', 950, 'survival', 3, today),
      bill('electric', 'Electric', 74, 'survival', 7, today),
      bill('phone', 'Phone', 45, 'survival', 8, today),
      {...bill('carda-pay', 'Card A payment', 160, 'debt', 9, today), cardId: 'carda'},
      bill('netflix', 'Netflix', 15.49, 'subscription', 11, today),
      {...bill('spotify', 'Spotify', 11.99, 'subscription', -6, today), paid: true},
      bill('gym', 'Gym', 40, 'subscription', 13, today),
    ],
    cats: [
      cat('gro', 'Groceries', 300, 182.4, '#5b8c5a', 0),
      cat('eat', 'Eating out', 120, 96.5, '#c9743d', 1),
      cat('tra', 'Transit', 60, 18, '#4f7fa8', 2),
      cat('fun', 'Fun', 80, 35, '#8b6fd8', 3),
      cat('per', 'Personal', 50, 12, '#b8607e', 4),
      {...cat('unc', 'Uncategorized', 0, 0, '#a89b88', 5), locked: true},
    ],
    txns: [
      txn('t1', 'Coffee', -4.5, 'Eating out', 0, today),
      txn('t2', 'Lunch — burrito bowl', -12.8, 'Eating out', 0, today),
      txn('t3', 'Groceries run', -36.2, 'Groceries', -1, today),
      txn('t4', 'Movie night', -15, 'Fun', -1, today),
      txn('t5', 'Bus pass', -18, 'Transit', -3, today),
      txn('t6', 'Set aside → Japan trip', -85, 'Goals', -3, today),
      txn('t7', 'Pharmacy', -9.4, 'Personal', -4, today),
      txn('t8', 'Spotify', -11.99, 'Subscription', -6, today),
      txn('t9', 'Groceries run', -42.7, 'Groceries', -7, today),
      txn('t10', 'Dinner with Sam', -28.5, 'Eating out', -8, today),
      txn('t11', 'Card A payment', -160, 'Debt', -9, today),
      txn('t12', 'Venmo from Alex', 22, 'Income', -10, today),
      txn('t13', 'Rent', -950, 'Bills', -12, today),
      txn('t14', 'Paycheck', 1700, 'Income', -14, today),
    ],
    deletedTxns: [],
    goals: [
      {
        id: 'japan',
        name: 'Japan trip',
        target: 2400,
        saved: 860,
        per: 85,
        note: 'Apr 2027',
        due: '2027-04-01',
        necessity: false,
        paused: null,
        behind: false,
        financed: 0,
        financedFrom: null,
        earnMonthly: 0,
      },
      {
        id: 'efund',
        name: 'Emergency fund',
        target: 1000,
        saved: 400,
        per: 40,
        note: 'your safety net',
        due: null,
        necessity: false,
        paused: null,
        behind: true,
        financed: 0,
        financedFrom: null,
        earnMonthly: 0,
      },
    ],
    cards: [
      {
        id: 'cardb',
        name: 'Card B',
        apr: 21.9,
        limit: 2000,
        balance: 650,
        dueDay: null,
        minPay: null,
        payInFull: false,
        planInstallment: 0,
        planMonthsLeft: 0,
        rewards: [],
        promoRate: 0,
        promoEnd: iso(today, 140),
        balanceUpdatedAt: isoTime(today, -2),
      },
      {
        id: 'carda',
        name: 'Card A',
        apr: 17.9,
        limit: 3500,
        balance: 1240,
        dueDay: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 9).getDate(),
        minPay: 160,
        payInFull: false,
        planInstallment: 0,
        planMonthsLeft: 0,
        rewards: [],
        promoRate: null,
        promoEnd: null,
        balanceUpdatedAt: isoTime(today, -34),
      },
    ],
  };
}

function bill(
  id: string,
  name: string,
  amount: number,
  kind: 'survival' | 'subscription' | 'debt',
  off: number,
  today: Date,
) {
  return {
    id,
    name,
    amount,
    kind,
    dueDate: iso(today, off),
    off,
    cycle: 'monthly' as const,
    paid: false,
    payFrom: null,
    cardId: null,
    oneTime: false,
    personal: false,
    lender: null,
  };
}

function cat(id: string, name: string, budget: number, spent: number, color: string, sort: number) {
  return {id, name, budget, spent, color, locked: false, sortOrder: sort};
}

function txn(
  id: string,
  label: string,
  amount: number,
  category: string,
  off: number,
  today: Date,
) {
  return {
    id,
    label,
    amount,
    cat: category,
    postedAt: isoTime(today, off),
    off,
    src: 'Main checking',
    cardId: null,
    billId: null,
  };
}
