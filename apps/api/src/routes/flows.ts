import {zValidator} from '@hono/zod-validator';
import {
  crunchLockSchema,
  expenseCreateSchema,
  loanCreateSchema,
  plannerStartSchema,
  setAsideSchema,
} from '@runway/shared';
import {Hono} from 'hono';
import {syncCardBill} from '../services/card-bill-sync';
import {prisma} from '../lib/db';
import {parseIsoDateUtc} from '../lib/dates';
import {adjustCashSource, resolveSource} from '../services/payment-source';
import {loadState} from '../services/app-state';

export const flowsRoutes = new Hono();

/** Add expense / money in (catalog §2.2). */
flowsRoutes.post('/expenses', zValidator('json', expenseCreateSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
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
  return c.json(await loadState(userId));
});

/** Manual "+ Set aside now" on a goal. */
flowsRoutes.post('/goals/:id/set-aside', zValidator('json', setAsideSchema), async (c) => {
  const userId = c.get('userId');
  const {amount, source} = c.req.valid('json');
  await prisma.$transaction(async (tx) => {
    const goal = await tx.goal.findFirst({where: {id: c.req.param('id'), userId}});
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
  return c.json(await loadState(userId));
});

/** Lock a cash-crunch plan (catalog §2.2). */
flowsRoutes.post('/crunch/lock', zValidator('json', crunchLockSchema), async (c) => {
  const userId = c.get('userId');
  const {pausedGoalIds, cardId, advance} = c.req.valid('json');
  await prisma.$transaction(async (tx) => {
    if (pausedGoalIds.length > 0) {
      await tx.goal.updateMany({
        where: {userId, id: {in: pausedGoalIds}},
        data: {paused: '__crunch'},
      });
    }
    if (cardId && advance && advance > 0) {
      const card = await tx.card.findFirst({where: {id: cardId, userId}});
      if (card) {
        await tx.card.update({
          where: {id: card.id},
          data: {balance: {increment: advance}, balanceUpdatedAt: new Date()},
        });
        await tx.profile.update({
          where: {userId},
          data: {primaryBalance: {increment: advance}},
        });
        await tx.txn.create({
          data: {
            userId,
            label: `Advance from ${card.name}`,
            amount: advance,
            cat: 'Income',
            postedAt: new Date(),
            src: card.name,
            cardId: card.id,
          },
        });
        await syncCardBill(tx, userId, card.id);
      }
    }
  });
  return c.json(await loadState(userId));
});

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
