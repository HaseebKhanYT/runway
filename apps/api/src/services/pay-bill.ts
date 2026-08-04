import {cardPaymentSplit} from '@runway/shared';
import {prisma} from '../lib/db';
import {cardMathFields, syncCardBill} from './card-bill-sync';
import {adjustCashSource, resolveSource} from './payment-source';

/** Pay a bill from a chosen source (catalog §2.2 "Pay a bill"). */
export async function payBill(userId: string, billId: string, source: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({where: {id: billId, userId}});
    if (!bill || bill.paid) return;
    const amount = Number(bill.amount);
    const resolved = await resolveSource(tx, userId, source);
    // A card cannot pay its own bill: the balance would fall by the bill and
    // nothing would be charged anywhere, so the debt would simply vanish.
    // Refuse before anything is written rather than half-applying it (#29).
    // The UI already declines to offer this — pay-source-modal filters the
    // bill's own card out of the list.
    if (resolved.kind === 'card' && resolved.id === bill.cardId) return;

    if (bill.cardId) {
      // This bill IS a card's payment: paying it reduces that card's balance.
      const card = await tx.card.findFirst({where: {id: bill.cardId, userId}});
      if (card) {
        // Read the plan off the card as it stands BEFORE the balance moves —
        // the split depends on the balance that carries the plan. One rule,
        // shared with the manual path: revolving first, remainder is
        // principal (#102). `cardPaymentSplit` caps at `planMonthsLeft`, so
        // the old `planMonthsLeft: {gt: 0}` guard is no longer needed.
        const {installments} = cardPaymentSplit(cardMathFields(card), amount);
        await tx.card.update({
          where: {id: card.id},
          data: {
            balance: {decrement: amount},
            ...(installments > 0 ? {planMonthsLeft: {decrement: installments}} : {}),
          },
        });
      }
    }
    if (resolved.kind === 'card' && resolved.id) {
      // Charged to a card: card balance goes up, cash untouched.
      await tx.card.update({
        where: {id: resolved.id},
        data: {balance: {increment: amount}, balanceUpdatedAt: new Date()},
      });
      await syncCardBill(tx, userId, resolved.id);
    } else {
      await adjustCashSource(tx, userId, resolved, -amount);
    }

    await tx.bill.update({where: {id: billId}, data: {paid: true, payFrom: source}});
    await tx.txn.create({
      data: {
        userId,
        label: bill.name,
        amount: -amount,
        cat:
          bill.kind === 'debt' ? 'Debt' : bill.kind === 'subscription' ? 'Subscription' : 'Bills',
        postedAt: new Date(),
        src: resolved.label,
        billId: bill.id,
        cardId: resolved.kind === 'card' ? resolved.id : null,
      },
    });
    if (bill.cardId) await syncCardBill(tx, userId, bill.cardId);
  });
}

/** Un-pay reverses the money and removes the synthetic transaction. */
export async function unpayBill(userId: string, billId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({where: {id: billId, userId}});
    if (!bill || !bill.paid) return;
    const amount = Number(bill.amount);
    const source = bill.payFrom ?? 'checking';
    const resolved = await resolveSource(tx, userId, source);
    // Same rule as `payBill`, and it also covers a stale `payFrom` naming the
    // bill's own card (#29).
    if (resolved.kind === 'card' && resolved.id === bill.cardId) return;

    if (bill.cardId) {
      await tx.card.updateMany({
        where: {id: bill.cardId, userId},
        data: {balance: {increment: amount}},
      });
      // Puts the installment back on a plan that is still running. A plan
      // already at zero stays there: nothing distinguishes "this payment
      // finished it" from "it was finished long ago", and resurrecting a
      // settled plan would bill an installment that is not owed. Undoing the
      // final payment therefore restores the principal but not the term — the
      // balance is billed by the card's ordinary rule from then on.
      await tx.card.updateMany({
        where: {id: bill.cardId, userId, planMonthsLeft: {gt: 0}},
        data: {planMonthsLeft: {increment: 1}},
      });
    }
    if (resolved.kind === 'card' && resolved.id) {
      await tx.card.update({
        where: {id: resolved.id},
        data: {balance: {decrement: amount}},
      });
      await syncCardBill(tx, userId, resolved.id);
    } else {
      await adjustCashSource(tx, userId, resolved, amount);
    }

    await tx.bill.update({where: {id: billId}, data: {paid: false}});
    await tx.txn.deleteMany({where: {userId, billId}});
    if (bill.cardId) await syncCardBill(tx, userId, bill.cardId);
  });
}
