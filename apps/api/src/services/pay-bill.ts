import {prisma} from '../lib/db';
import {syncCardBill} from './card-bill-sync';
import {adjustCashSource, resolveSource} from './payment-source';

/** Pay a bill from a chosen source (catalog §2.2 "Pay a bill"). */
export async function payBill(userId: string, billId: string, source: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({where: {id: billId, userId}});
    if (!bill || bill.paid) return;
    const amount = Number(bill.amount);
    const resolved = await resolveSource(tx, userId, source);

    if (bill.cardId) {
      // This bill IS a card's payment: paying it reduces that card's balance.
      await tx.card.updateMany({
        where: {id: bill.cardId, userId},
        data: {balance: {decrement: amount}},
      });
    }
    if (resolved.kind === 'card' && resolved.id !== bill.cardId) {
      // Charged to a card: card balance goes up, cash untouched.
      await tx.card.update({
        where: {id: resolved.id ?? ''},
        data: {balance: {increment: amount}, balanceUpdatedAt: new Date()},
      });
      await syncCardBill(tx, userId, resolved.id ?? '');
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

    if (bill.cardId) {
      await tx.card.updateMany({
        where: {id: bill.cardId, userId},
        data: {balance: {increment: amount}},
      });
    }
    if (resolved.kind === 'card' && resolved.id !== bill.cardId) {
      await tx.card.update({
        where: {id: resolved.id ?? ''},
        data: {balance: {decrement: amount}},
      });
      await syncCardBill(tx, userId, resolved.id ?? '');
    } else {
      await adjustCashSource(tx, userId, resolved, amount);
    }

    await tx.bill.update({where: {id: billId}, data: {paid: false}});
    await tx.txn.deleteMany({where: {userId, billId}});
    if (bill.cardId) await syncCardBill(tx, userId, bill.cardId);
  });
}
