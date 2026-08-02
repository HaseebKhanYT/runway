import {minPaymentGuess} from '@runway/shared';
import type {PrismaTx} from './lib/db';
import {nextDueDate} from './lib/dates';

/**
 * The single choke point (catalog §2.2): keeps each card's "{card} payment"
 * debt bill in step with its due day, and pins pay-in-full bills to the live
 * balance no matter which code path moved it.
 */
export async function syncCardBill(db: PrismaTx, userId: string, cardId: string): Promise<void> {
  const card = await db.card.findFirst({where: {id: cardId, userId}});
  const existing = await db.bill.findFirst({where: {userId, cardId}});
  if (!card) {
    if (existing) await db.bill.delete({where: {id: existing.id}});
    return;
  }
  if (card.dueDay == null) {
    if (existing) await db.bill.delete({where: {id: existing.id}});
    return;
  }

  const balance = Number(card.balance);
  const amount = card.payInFull
    ? balance
    : card.minPay != null
      ? Number(card.minPay)
      : existing
        ? Number(existing.amount)
        : minPaymentGuess(balance);

  const dueDate = nextDueDate(card.dueDay, new Date());
  if (existing) {
    await db.bill.update({
      where: {id: existing.id},
      data: {name: `${card.name} payment`, amount, dueDate},
    });
  } else {
    await db.bill.create({
      data: {
        userId,
        name: `${card.name} payment`,
        amount,
        kind: 'debt',
        dueDate,
        cardId: card.id,
        payFrom: 'checking',
      },
    });
  }
}
