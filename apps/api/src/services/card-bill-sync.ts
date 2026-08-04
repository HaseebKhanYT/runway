import type {Card as CardRow} from '@prisma/client';
import {cardPaymentDue, type CardPaymentFields} from '@runway/shared';
import type {PrismaTx} from '../lib/db';
import {nextDueDate} from '../lib/dates';

/**
 * The subset of a card row the shared card math reads, as plain numbers.
 * Exported so every caller converts a Decimal the same way rather than
 * spelling the mapping out again.
 */
export function cardMathFields(card: CardRow): CardPaymentFields {
  return {
    balance: Number(card.balance),
    planInstallment: Number(card.planInstallment),
    planMonthsLeft: card.planMonthsLeft,
    payInFull: card.payInFull,
    minPay: card.minPay == null ? null : Number(card.minPay),
  };
}

/**
 * The single choke point (catalog §2.2): keeps each card's "{card} payment"
 * debt bill in step with its due day and with the live balance, no matter
 * which code path moved it. What the bill asks for is `cardPaymentDue` —
 * one installment of any term plan, plus the card's own rule on the rest.
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

  const amount = cardPaymentDue(cardMathFields(card), existing ? Number(existing.amount) : null);

  const dueDate = nextDueDate(card.dueDay, new Date());
  if (existing) {
    await db.bill.update({
      where: {id: existing.id},
      data: {
        name: `${card.name} payment`,
        dueDate,
        // A paid bill is a record of a payment that happened, not a forecast.
        // Restating its amount rewrote history: undo reverses `bill.amount`,
        // so a pay-in-full card whose payment zeroed the balance had its bill
        // rewritten to $0 and could not be undone at all (#106). Payday
        // resets `paid` for every bill, so the freeze lasts one cycle.
        ...(existing.paid ? {} : {amount}),
      },
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
