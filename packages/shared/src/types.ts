import type {Cadence} from './cycles';

export interface Profile {
  name: string;
  email: string;
  cadence: Cadence;
  /** ISO date of the next expected paycheck, or null when unset. */
  nextPay: string | null;
  payAmount: number;
  primaryName: string;
  primaryBalance: number;
  primaryLogo: string | null;
  notifBills: boolean;
  notifWeekly: boolean;
  onboarded: boolean;
}

export type AccountType = 'checking' | 'cash' | 'savings';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  logo: string | null;
}

export type BillKind = 'survival' | 'subscription' | 'debt';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  kind: BillKind;
  /**
   * ISO due date. The single source of truth for when this bill lands: a day
   * offset is whatever the *reader* derives from this and its own clock, so
   * the API deliberately does not send one.
   */
  dueDate: string;
  cycle: 'monthly' | 'yearly';
  paid: boolean;
  /** 'checking' | account id | card id. */
  payFrom: string | null;
  /** Set when this bill IS a card's payment. */
  cardId: string | null;
  oneTime: boolean;
  personal: boolean;
  lender: string | null;
}

export interface Category {
  id: string;
  name: string;
  budget: number;
  spent: number;
  color: string;
  locked: boolean;
  sortOrder: number;
}

export interface Txn {
  id: string;
  label: string;
  /** Signed: negative = money out. */
  amount: number;
  cat: string;
  /** ISO timestamp. */
  postedAt: string;
  /** Days from today (0 today, -1 yesterday) — derived at read time. */
  off: number;
  src: string | null;
  cardId: string | null;
  billId: string | null;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  per: number;
  note: string;
  /** ISO date or null. */
  due: string | null;
  necessity: boolean;
  /** null | '__crunch' | plan name. */
  paused: string | null;
  behind: boolean;
  financed: number;
  financedFrom: string | null;
  /** Extra income per month this plan depends on, from the "earn" lever. */
  earnMonthly: number;
}

export interface CardReward {
  rate: string;
  cat: string;
}

export interface Card {
  id: string;
  name: string;
  apr: number;
  limit: number;
  balance: number;
  dueDay: number | null;
  minPay: number | null;
  payInFull: boolean;
  /** One month of a planner term plan — fixed when the plan was locked in. */
  planInstallment: number;
  /** Installments still to pay on that plan. */
  planMonthsLeft: number;
  rewards: CardReward[];
  promoRate: number | null;
  /** ISO date the promo rate ends, or null. */
  promoEnd: string | null;
  /** ISO timestamp of the last manual balance update. */
  balanceUpdatedAt: string;
}

export interface AppState {
  profile: Profile;
  accounts: Account[];
  bills: Bill[];
  cats: Category[];
  txns: Txn[];
  deletedTxns: Txn[];
  goals: Goal[];
  cards: Card[];
}
