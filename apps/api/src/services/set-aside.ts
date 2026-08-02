import {prisma} from '../lib/db';
import {adjustCashSource, resolveSource} from './payment-source';

/** Manual "+ Set aside now" on a goal — cash sources only. */
export async function setAsideForGoal(
  userId: string,
  goalId: string,
  amount: number,
  source: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const goal = await tx.goal.findFirst({where: {id: goalId, userId}});
    if (!goal) return;
    const resolved = await resolveSource(tx, userId, source);
    if (resolved.kind === 'card') return; // set-asides come from cash only
    await adjustCashSource(tx, userId, resolved, -amount);
    await tx.goal.update({where: {id: goal.id}, data: {saved: {increment: amount}}});
    await tx.txn.create({
      data: {
        userId,
        label: `Set aside → ${goal.name}`,
        amount: -amount,
        cat: 'Goals',
        postedAt: new Date(),
        src: resolved.label,
      },
    });
  });
}
