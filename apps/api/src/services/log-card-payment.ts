import {cardPaymentSplit, round2} from '@runway/shared';
import {prisma} from '../lib/db';
import {cardMathFields, syncCardBill} from './card-bill-sync';
import {adjustCashSource, resolveSource} from './payment-source';

/** Log a manual card payment: balance drops, source drops, txn recorded. */
export async function logCardPayment(
  userId: string,
  cardId: string,
  amount: number,
  source: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const card = await tx.card.findFirst({where: {id: cardId, userId}});
    if (!card) return;
    // Resolving through the shared helper rather than looking the source up
    // inline is what gives this path a fallback: an id that matches nothing
    // used to clear the card and debit nothing at all (#81).
    const resolved = await resolveSource(tx, userId, source);
    // A card cannot pay itself, for the same reason it cannot pay its own
    // bill: the balance would fall with no money moving (#29).
    if (resolved.kind === 'card' && resolved.id === cardId) return;

    // A payment can only settle debt that exists. Without this an overpayment
    // drives the balance negative and `syncCardBill` bills a negative amount
    // (#81). Deliberately local to this path — `payBill` must move exactly
    // `bill.amount`, because `unpayBill` reverses exactly `bill.amount`.
    const applied = Math.min(round2(amount), Math.max(0, Number(card.balance)));
    if (applied <= 0) return;

    // One rule, shared with the bill path: the card's ordinary repayment rule
    // is served first, and only the remainder is plan principal (#102).
    const {installments} = cardPaymentSplit(cardMathFields(card), applied);

    // The bill as it stood before the payment — what the user was asked for.
    const bill = await tx.bill.findFirst({where: {userId, cardId}});

    await tx.card.update({
      where: {id: cardId},
      data: {
        balance: {decrement: applied},
        ...(installments > 0 ? {planMonthsLeft: {decrement: installments}} : {}),
        balanceUpdatedAt: new Date(),
      },
    });

    if (resolved.kind === 'card' && resolved.id) {
      // Paid with another card: that card's balance rises, cash untouched —
      // the same move `payBill` and `logExpense` make for a card source.
      await tx.card.update({
        where: {id: resolved.id},
        data: {balance: {increment: applied}, balanceUpdatedAt: new Date()},
      });
      await syncCardBill(tx, userId, resolved.id);
    } else {
      await adjustCashSource(tx, userId, resolved, -applied);
    }

    await tx.txn.create({
      data: {
        userId,
        label: `${card.name} payment`,
        amount: -applied,
        cat: 'Debt',
        postedAt: new Date(),
        // The account's own name, not a hardcoded "Main checking" — a renamed
        // account used to be mislabelled in Activity (#81).
        src: resolved.label,
        cardId: card.id,
      },
    });

    // The payment the user just logged is the payment the bill was asking
    // for, so the runway must stop subtracting it (#30). Marked before the
    // sync so the sync sees a settled bill and leaves its amount alone.
    // A partial payment clears nothing: the bill stands and is re-priced.
    if (bill && !bill.paid && applied >= Number(bill.amount)) {
      await tx.bill.update({where: {id: bill.id}, data: {paid: true, payFrom: source}});
    }
    await syncCardBill(tx, userId, cardId);
  });
}
