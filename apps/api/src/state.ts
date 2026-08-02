import type {AppState} from '@runway/shared';
import type {PrismaTx} from './lib/db';
import {prisma} from './lib/db';
import {serializeState} from './serialize';

export async function ensureUser(userId: string): Promise<void> {
  await prisma.profile.upsert({
    where: {userId},
    update: {},
    create: {userId},
  });
}

/** Load and serialize the user's full app state. */
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
