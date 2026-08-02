import {prisma} from '../lib/db';
import {syncCardBill} from './card-bill-sync';

/** Log a manual card payment: balance drops, cash source drops, txn recorded. */
export async function logCardPayment(
  userId: string,
  cardId: string,
  amount: number,
  source: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const card = await tx.card.findFirst({where: {id: cardId, userId}});
    if (!card) return;
    await tx.card.update({
      where: {id: cardId},
      data: {balance: {decrement: amount}, balanceUpdatedAt: new Date()},
    });
    let src = 'Main checking';
    if (source !== 'checking') {
      const account = await tx.account.findFirst({where: {id: source, userId}});
      if (account) {
        await tx.account.update({
          where: {id: account.id},
          data: {balance: {decrement: amount}},
        });
        src = account.name;
      }
    } else {
      await tx.profile.update({
        where: {userId},
        data: {primaryBalance: {decrement: amount}},
      });
    }
    await tx.txn.create({
      data: {
        userId,
        label: `${card.name} payment`,
        amount: -amount,
        cat: 'Debt',
        postedAt: new Date(),
        src,
        cardId: card.id,
      },
    });
    await syncCardBill(tx, userId, cardId);
  });
}
