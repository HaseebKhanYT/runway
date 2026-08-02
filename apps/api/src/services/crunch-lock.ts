import {prisma} from '../lib/db';
import {syncCardBill} from './card-bill-sync';

/** Lock a cash-crunch plan (catalog §2.2): pause goals, advance on a card. */
export async function lockCrunchPlan(
  userId: string,
  pausedGoalIds: string[],
  cardId: string | null | undefined,
  advance: number | null | undefined,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (pausedGoalIds.length > 0) {
      await tx.goal.updateMany({
        where: {userId, id: {in: pausedGoalIds}},
        data: {paused: '__crunch'},
      });
    }
    if (cardId && advance && advance > 0) {
      const card = await tx.card.findFirst({where: {id: cardId, userId}});
      if (card) {
        await tx.card.update({
          where: {id: card.id},
          data: {balance: {increment: advance}, balanceUpdatedAt: new Date()},
        });
        await tx.profile.update({
          where: {userId},
          data: {primaryBalance: {increment: advance}},
        });
        await tx.txn.create({
          data: {
            userId,
            label: `Advance from ${card.name}`,
            amount: advance,
            cat: 'Income',
            postedAt: new Date(),
            src: card.name,
            cardId: card.id,
          },
        });
        await syncCardBill(tx, userId, card.id);
      }
    }
  });
}
