import {round2} from '@runway/shared';
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
    // A manual payment settles as many whole installments of a term plan as it
    // covers — paying two months up front should shorten the plan by two.
    const per = Number(card.planInstallment);
    const settled = per > 0 ? Math.min(card.planMonthsLeft, Math.floor(round2(amount) / per)) : 0;
    await tx.card.update({
      where: {id: cardId},
      data: {
        balance: {decrement: amount},
        ...(settled > 0 ? {planMonthsLeft: {decrement: settled}} : {}),
        balanceUpdatedAt: new Date(),
      },
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
