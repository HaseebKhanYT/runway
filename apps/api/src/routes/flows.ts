import {zValidator} from '@hono/zod-validator';
import {crunchLockSchema, loanCreateSchema, plannerStartSchema} from '@runway/shared';
import {Hono} from 'hono';
import {syncCardBill} from '../services/card-bill-sync';
import {prisma} from '../lib/db';
import {parseIsoDateUtc} from '../lib/dates';
import {adjustCashSource, resolveSource} from '../services/payment-source';
import {loadState} from '../services/app-state';

export const flowsRoutes = new Hono();

/** Friend loan: cash today, a "Pay back" debt bill on the runway (catalog §1.10). */
flowsRoutes.post('/loans', zValidator('json', loanCreateSchema), async (c) => {
  const userId = c.get('userId');
  const {who, amount, dueDate} = c.req.valid('json');
  await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUniqueOrThrow({where: {userId}});
    await tx.profile.update({
      where: {userId},
      data: {primaryBalance: {increment: amount}},
    });
    await tx.txn.create({
      data: {
        userId,
        label: `Loan from ${who}`,
        amount,
        cat: 'Income',
        postedAt: new Date(),
        src: profile.primaryName,
      },
    });
    await tx.bill.create({
      data: {
        userId,
        name: `Pay back ${who}`,
        amount,
        kind: 'debt',
        dueDate: parseIsoDateUtc(dueDate),
        oneTime: true,
        personal: true,
        lender: who,
        payFrom: 'checking',
      },
    });
  });
  return c.json(await loadState(userId));
});

/** Start a planner goal, pausing wishes and financing on a card (catalog §2.2). */
flowsRoutes.post('/planner/start', zValidator('json', plannerStartSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
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
        const headroom = Math.floor(Number(card.limit) - Number(card.balance));
        financed = Math.min(headroom, Math.ceil(body.target));
        financedFrom = card.name;
        if (financed > 0) {
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
  return c.json(await loadState(userId));
});
