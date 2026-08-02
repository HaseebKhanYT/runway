import type {plannerStartSchema} from '@runway/shared';
import type {z} from 'zod';
import {prisma} from '../lib/db';
import {syncCardBill} from './card-bill-sync';

type PlanStartInput = z.infer<typeof plannerStartSchema>;

/** Start a planner goal, pausing wishes and financing on a card (catalog §2.2). */
export async function startPlan(userId: string, body: PlanStartInput): Promise<void> {
  const today = new Date();
  await prisma.$transaction(async (tx) => {
    if (body.pausedIds.length > 0) {
      await tx.goal.updateMany({
        where: {userId, id: {in: body.pausedIds}},
        data: {paused: body.name},
      });
    }
    let financed = 0;
    let financedFrom: string | null = null;
    if (body.cardId) {
      const card = await tx.card.findFirst({where: {id: body.cardId, userId}});
      if (card) {
        // A card over its limit has no headroom to lend, not negative headroom:
        // an unclamped difference used to reach the goal as a negative `saved`.
        const headroom = Math.max(0, Math.floor(Number(card.limit) - Number(card.balance)));
        financed = Math.min(headroom, Math.ceil(body.target));
        if (financed > 0) {
          financedFrom = card.name;
          await tx.card.update({
            where: {id: card.id},
            data: {balance: {increment: financed}, balanceUpdatedAt: new Date()},
          });
          const finDue = new Date(today);
          finDue.setDate(finDue.getDate() + 10);
          await tx.bill.create({
            data: {
              userId,
              name: `${body.name} financing`,
              amount: Math.ceil(financed / body.months),
              kind: 'debt',
              dueDate: finDue,
              payFrom: 'checking',
            },
          });
          await syncCardBill(tx, userId, card.id);
        }
      }
    }
    const due = new Date(today.getFullYear(), today.getMonth() + body.months, 1);
    const per = Math.max(0, Math.ceil(body.target / (body.months * 2)));
    await tx.goal.create({
      data: {
        userId,
        name: body.name,
        target: body.target,
        saved: financed,
        per,
        note: due.toLocaleDateString('en-US', {month: 'short', year: 'numeric'}),
        due,
        necessity: body.kind === 'necessity',
        financed,
        financedFrom,
      },
    });
  });
}
