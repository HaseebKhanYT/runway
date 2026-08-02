import type {Prisma} from '@prisma/client';
import {demoData} from '@runway/shared';
import {prisma} from '../lib/db';
import {parseIsoDateUtc} from '../lib/dates';

/** Reset to the design's demo dataset (Settings → Reset app data). */
export async function resetToDemoData(userId: string): Promise<void> {
  const today = new Date();
  const demo = demoData(today);
  await prisma.$transaction(async (tx) => {
    await tx.bill.deleteMany({where: {userId}});
    await tx.category.deleteMany({where: {userId}});
    await tx.card.deleteMany({where: {userId}});
    await tx.goal.deleteMany({where: {userId}});
    await tx.txn.deleteMany({where: {userId}});
    await tx.account.deleteMany({where: {userId}});

    await tx.profile.update({
      where: {userId},
      data: {
        cadence: demo.profile.cadence,
        nextPay: demo.profile.nextPay ? parseIsoDateUtc(demo.profile.nextPay) : null,
        payAmount: demo.profile.payAmount,
        primaryName: demo.profile.primaryName,
        primaryBalance: demo.profile.primaryBalance,
        onboardedAt: new Date(),
      },
    });

    const cardIdMap = new Map<string, string>();
    for (const card of demo.cards) {
      const created = await tx.card.create({
        data: {
          userId,
          name: card.name,
          apr: card.apr,
          limit: card.limit,
          balance: card.balance,
          dueDay: card.dueDay,
          minPay: card.minPay,
          payInFull: card.payInFull,
          rewards: card.rewards as unknown as Prisma.InputJsonValue,
          promoRate: card.promoRate,
          promoEnd: card.promoEnd ? parseIsoDateUtc(card.promoEnd) : null,
          balanceUpdatedAt: new Date(card.balanceUpdatedAt),
        },
      });
      cardIdMap.set(card.id, created.id);
    }
    for (const bill of demo.bills) {
      await tx.bill.create({
        data: {
          userId,
          name: bill.name,
          amount: bill.amount,
          kind: bill.kind,
          dueDate: parseIsoDateUtc(bill.dueDate),
          cycle: bill.cycle,
          paid: bill.paid,
          cardId: bill.cardId ? (cardIdMap.get(bill.cardId) ?? null) : null,
        },
      });
    }
    for (const cat of demo.cats) {
      await tx.category.create({
        data: {
          userId,
          name: cat.name,
          budget: cat.budget,
          spent: cat.spent,
          color: cat.color,
          locked: cat.locked,
          sortOrder: cat.sortOrder,
        },
      });
    }
    for (const txn of demo.txns) {
      await tx.txn.create({
        data: {
          userId,
          label: txn.label,
          amount: txn.amount,
          cat: txn.cat,
          postedAt: new Date(txn.postedAt),
          src: txn.src,
        },
      });
    }
    for (const goal of demo.goals) {
      await tx.goal.create({
        data: {
          userId,
          name: goal.name,
          target: goal.target,
          saved: goal.saved,
          per: goal.per,
          note: goal.note,
          due: goal.due ? parseIsoDateUtc(goal.due) : null,
          behind: goal.behind,
        },
      });
    }
  });
}
