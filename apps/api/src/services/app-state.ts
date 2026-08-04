import type {Account, Bill, Card, Category, Goal, Prisma, Profile, Txn} from '@prisma/client';
import {
  daysUntil,
  midnight,
  MS_PER_DAY,
  parseCadence,
  type AppState,
  type CardReward,
} from '@runway/shared';
import type {PrismaTx} from '../lib/db';
import {prisma} from '../lib/db';

export async function ensureUser(userId: string): Promise<void> {
  await prisma.profile.upsert({
    where: {userId},
    update: {},
    create: {userId},
  });
}

/** Load the user's rows and serialize them into the wire AppState. */
export async function loadState(userId: string, db: PrismaTx = prisma): Promise<AppState> {
  const today = new Date();
  const [profile, accounts, bills, cats, txns, deletedTxns, goals, cards] = await Promise.all([
    db.profile.findUniqueOrThrow({where: {userId}}),
    db.account.findMany({where: {userId}, orderBy: {name: 'asc'}}),
    db.bill.findMany({where: {userId}, orderBy: {dueDate: 'asc'}}),
    db.category.findMany({where: {userId}, orderBy: {sortOrder: 'asc'}}),
    db.txn.findMany({
      where: {userId, deletedAt: null},
      orderBy: [{postedAt: 'desc'}, {id: 'desc'}],
    }),
    db.txn.findMany({
      where: {userId, deletedAt: {not: null}},
      orderBy: {deletedAt: 'desc'},
    }),
    db.goal.findMany({where: {userId}, orderBy: {name: 'asc'}}),
    db.card.findMany({where: {userId}, orderBy: {balance: 'desc'}}),
  ]);
  return serializeState({profile, accounts, bills, cats, txns, deletedTxns, goals, cards}, today);
}

function toNumber(d: Prisma.Decimal | null): number {
  return d == null ? 0 : Number(d);
}

function isoDate(d: Date | null): string | null {
  if (!d) return null;
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

/**
 * Whole days from `today` to the transaction's posted date (0 today, -1
 * yesterday), compared at local midnights on both sides — the same frame
 * `daysUntil` uses for bills. Mixing UTC parts for one side used to shift
 * evening transactions into "tomorrow" for negative-UTC-offset zones.
 */
function daysFromToday(postedAt: Date, today: Date): number {
  return Math.round((midnight(postedAt) - midnight(today)) / MS_PER_DAY);
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
function serializeState(rows: Rows, today: Date): AppState {
  const {profile} = rows;
  return {
    profile: {
      name: profile.name,
      email: profile.email,
      // `Profile.cadence` is an unconstrained text column, so a cast here would
      // hand the runway math a string it silently treats as biweekly. Parsing
      // fails the request instead — wrong money is worse than no money.
      cadence: parseCadence(profile.cadence),
      nextPay: isoDate(profile.nextPay),
      payAmount: toNumber(profile.payAmount),
      primaryName: profile.primaryName,
      primaryBalance: toNumber(profile.primaryBalance),
      primaryLogo: profile.primaryLogo,
      notifBills: profile.notifBills,
      notifWeekly: profile.notifWeekly,
      onboarded: profile.onboardedAt != null,
    },
    accounts: rows.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as AppState['accounts'][number]['type'],
      balance: toNumber(a.balance),
      logo: a.logo,
    })),
    bills: rows.bills.map((b) => {
      const due = isoDate(b.dueDate) ?? '1970-01-01';
      return {
        id: b.id,
        name: b.name,
        amount: toNumber(b.amount),
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
      budget: toNumber(c.budget),
      spent: toNumber(c.spent),
      color: c.color,
      locked: c.locked,
      sortOrder: c.sortOrder,
    })),
    txns: rows.txns.map((t) => serializeTxn(t, today)),
    deletedTxns: rows.deletedTxns.map((t) => serializeTxn(t, today)),
    goals: rows.goals.map((g) => ({
      id: g.id,
      name: g.name,
      target: toNumber(g.target),
      saved: toNumber(g.saved),
      per: toNumber(g.per),
      note: g.note,
      due: isoDate(g.due),
      necessity: g.necessity,
      paused: g.paused,
      behind: g.behind,
      financed: toNumber(g.financed),
      financedFrom: g.financedFrom,
      earnMonthly: toNumber(g.earnMonthly),
    })),
    cards: rows.cards.map((c) => ({
      id: c.id,
      name: c.name,
      apr: toNumber(c.apr),
      limit: toNumber(c.limit),
      balance: toNumber(c.balance),
      dueDay: c.dueDay,
      minPay: c.minPay == null ? null : toNumber(c.minPay),
      payInFull: c.payInFull,
      planInstallment: toNumber(c.planInstallment),
      planMonthsLeft: c.planMonthsLeft,
      rewards: (c.rewards as unknown as CardReward[]) ?? [],
      promoRate: c.promoRate == null ? null : toNumber(c.promoRate),
      promoEnd: isoDate(c.promoEnd),
      balanceUpdatedAt: c.balanceUpdatedAt.toISOString(),
    })),
  };
}

function serializeTxn(t: Txn, today: Date): AppState['txns'][number] {
  return {
    id: t.id,
    label: t.label,
    amount: toNumber(t.amount),
    cat: t.cat,
    postedAt: t.postedAt.toISOString(),
    off: daysFromToday(t.postedAt, today),
    src: t.src,
    cardId: t.cardId,
    billId: t.billId,
  };
}
