import type {Account, Bill, Card, Category, Goal, Prisma, Profile, Txn} from '@prisma/client';
import {
  daysUntil,
  type AppState,
  type Cadence,
  type CardReward,
} from '@runway/shared';

function num(d: Prisma.Decimal | null): number {
  return d == null ? 0 : Number(d);
}

function isoDate(d: Date | null): string | null {
  if (!d) return null;
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

function txnOff(postedAt: Date, today: Date): number {
  const posted = new Date(
    postedAt.getUTCFullYear(),
    postedAt.getUTCMonth(),
    postedAt.getUTCDate(),
  ).getTime();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((posted - now) / 86400000);
}

interface Rows {
  profile: Profile;
  accounts: Account[];
  bills: Bill[];
  cats: Category[];
  txns: Txn[];
  deletedTxns: Txn[];
  goals: Goal[];
  cards: Card[];
}

/** Prisma rows -> the wire AppState consumed by web and shared math. */
export function serializeState(rows: Rows, today: Date): AppState {
  const {profile} = rows;
  return {
    profile: {
      name: profile.name,
      email: profile.email,
      cadence: profile.cadence as Cadence,
      nextPay: isoDate(profile.nextPay),
      payAmount: num(profile.payAmount),
      primaryName: profile.primaryName,
      primaryBalance: num(profile.primaryBalance),
      primaryLogo: profile.primaryLogo,
      notifBills: profile.notifBills,
      notifWeekly: profile.notifWeekly,
      onboarded: profile.onboardedAt != null,
    },
    accounts: rows.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as AppState['accounts'][number]['type'],
      balance: num(a.balance),
      logo: a.logo,
    })),
    bills: rows.bills.map((b) => {
      const due = isoDate(b.dueDate) ?? '1970-01-01';
      return {
        id: b.id,
        name: b.name,
        amount: num(b.amount),
        kind: b.kind as AppState['bills'][number]['kind'],
        dueDate: due,
        off: daysUntil(due, today),
        cycle: b.cycle as 'monthly' | 'yearly',
        paid: b.paid,
        payFrom: b.payFrom,
        cardId: b.cardId,
        oneTime: b.oneTime,
        personal: b.personal,
        lender: b.lender,
      };
    }),
    cats: rows.cats.map((c) => ({
      id: c.id,
      name: c.name,
      budget: num(c.budget),
      spent: num(c.spent),
      color: c.color,
      locked: c.locked,
      sortOrder: c.sortOrder,
    })),
    txns: rows.txns.map((t) => serializeTxn(t, today)),
    deletedTxns: rows.deletedTxns.map((t) => serializeTxn(t, today)),
    goals: rows.goals.map((g) => ({
      id: g.id,
      name: g.name,
      target: num(g.target),
      saved: num(g.saved),
      per: num(g.per),
      note: g.note,
      due: isoDate(g.due),
      necessity: g.necessity,
      paused: g.paused,
      behind: g.behind,
      financed: num(g.financed),
      financedFrom: g.financedFrom,
    })),
    cards: rows.cards.map((c) => ({
      id: c.id,
      name: c.name,
      apr: num(c.apr),
      limit: num(c.limit),
      balance: num(c.balance),
      dueDay: c.dueDay,
      minPay: c.minPay == null ? null : num(c.minPay),
      payInFull: c.payInFull,
      rewards: (c.rewards as unknown as CardReward[]) ?? [],
      promoRate: c.promoRate == null ? null : num(c.promoRate),
      promoEnd: isoDate(c.promoEnd),
      balanceUpdatedAt: c.balanceUpdatedAt.toISOString(),
    })),
  };
}

function serializeTxn(t: Txn, today: Date): AppState['txns'][number] {
  return {
    id: t.id,
    label: t.label,
    amount: num(t.amount),
    cat: t.cat,
    postedAt: t.postedAt.toISOString(),
    off: txnOff(t.postedAt, today),
    src: t.src,
    cardId: t.cardId,
    billId: t.billId,
  };
}
