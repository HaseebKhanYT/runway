import {CAT_PALETTE, type onboardingCompleteSchema} from '@runway/shared';
import type {z} from 'zod';
import {prisma} from '../lib/db';
import {nextDueDate, parseIsoDateUtc} from '../lib/dates';

type OnboardingInput = z.infer<typeof onboardingCompleteSchema>;

/** Finish setup: replaces bills/categories/cards, zeroes goals & activity. */
export async function completeOnboarding(userId: string, body: OnboardingInput): Promise<void> {
  const today = new Date();
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
        ...(body.name !== undefined ? {name: body.name} : {}),
        ...(body.email !== undefined ? {email: body.email} : {}),
        cadence: body.cadence,
        nextPay: parseIsoDateUtc(body.nextPay),
        payAmount: body.pay,
        primaryBalance: body.balance,
        onboardedAt: new Date(),
      },
    });

    for (const bill of body.bills) {
      await tx.bill.create({
        data: {
          userId,
          name: bill.name,
          amount: bill.amount,
          kind: bill.kind,
          dueDate: nextDueDate(bill.dueDay, today),
        },
      });
    }
    for (const card of body.cards) {
      await tx.card.create({
        data: {
          userId,
          name: card.name,
          apr: card.apr,
          limit: card.limit,
          balance: card.balance,
          balanceUpdatedAt: new Date(),
        },
      });
    }
    let i = 0;
    for (const cat of body.cats) {
      await tx.category.create({
        data: {
          userId,
          name: cat.name,
          budget: cat.budget,
          color: CAT_PALETTE[i % CAT_PALETTE.length],
          sortOrder: i,
        },
      });
      i += 1;
    }
    await tx.category.create({
      data: {
        userId,
        name: 'Uncategorized',
        budget: 0,
        color: '#a89b88',
        locked: true,
        sortOrder: i,
      },
    });
  });
}
