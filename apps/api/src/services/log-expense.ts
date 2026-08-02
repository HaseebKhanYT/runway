import type {expenseCreateSchema} from '@runway/shared';
import type {z} from 'zod';
import {prisma} from '../lib/db';
import {syncCardBill} from './card-bill-sync';
import {adjustCashSource, resolveSource} from './payment-source';

type ExpenseInput = z.infer<typeof expenseCreateSchema>;

/** Add expense / money in (catalog §2.2). */
export async function logExpense(userId: string, body: ExpenseInput): Promise<void> {
  const today = new Date();
  await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUniqueOrThrow({where: {userId}});
    if (body.kind === 'expense') {
      const cat =
        (await tx.category.findFirst({where: {userId, name: body.category}})) ??
        (await tx.category.findFirst({where: {userId, locked: true}}));
      if (cat) {
        await tx.category.update({
          where: {id: cat.id},
          data: {spent: {increment: body.amount}},
        });
      }
      const resolved = await resolveSource(tx, userId, body.source);
      if (resolved.kind === 'card' && resolved.id) {
        // Card spend: the card balance rises; cash is untouched.
        await tx.card.update({
          where: {id: resolved.id},
          data: {balance: {increment: body.amount}, balanceUpdatedAt: new Date()},
        });
        await syncCardBill(tx, userId, resolved.id);
      } else {
        await adjustCashSource(tx, userId, resolved, -body.amount);
      }
      await tx.txn.create({
        data: {
          userId,
          label: body.note?.trim() || cat?.name || 'Expense',
          amount: -body.amount,
          cat: cat?.name ?? 'Uncategorized',
          postedAt: today,
          src: resolved.label,
          cardId: resolved.kind === 'card' ? resolved.id : null,
        },
      });
    } else {
      await tx.profile.update({
        where: {userId},
        data: {primaryBalance: {increment: body.amount}},
      });
      await tx.txn.create({
        data: {
          userId,
          label: body.note?.trim() || body.incomeKind,
          amount: body.amount,
          cat: 'Income',
          postedAt: today,
          src: profile.primaryName,
        },
      });
      if (body.goalId) {
        const goal = await tx.goal.findFirst({where: {id: body.goalId, userId}});
        if (goal) {
          const applied = Math.min(body.amount, Number(goal.target) - Number(goal.saved));
          if (applied > 0) {
            await tx.profile.update({
              where: {userId},
              data: {primaryBalance: {decrement: applied}},
            });
            await tx.goal.update({where: {id: goal.id}, data: {saved: {increment: applied}}});
            await tx.txn.create({
              data: {
                userId,
                label: `Set aside → ${goal.name}`,
                amount: -applied,
                cat: 'Goals',
                postedAt: today,
                src: profile.primaryName,
              },
            });
          }
        }
      }
    }
  });
}
