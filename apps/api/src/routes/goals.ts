import {zValidator} from '@hono/zod-validator';
import {goalCreateSchema, goalPatchSchema} from '@runway/shared';
import {Hono} from 'hono';
import {prisma} from '../lib/db';
import {parseIsoDateUtc} from '../lib/dates';
import {loadState} from '../services/app-state';

export const goalsRoutes = new Hono();

goalsRoutes.post('/goals', zValidator('json', goalCreateSchema), async (c) => {
  const userId = c.get('userId');
  const {due, ...rest} = c.req.valid('json');
  await prisma.goal.create({
    data: {userId, ...rest, due: due ? parseIsoDateUtc(due) : null},
  });
  return c.json(await loadState(userId));
});

goalsRoutes.patch('/goals/:id', zValidator('json', goalPatchSchema), async (c) => {
  const userId = c.get('userId');
  const {due, ...rest} = c.req.valid('json');
  await prisma.goal.updateMany({
    where: {id: c.req.param('id'), userId},
    data: {
      ...rest,
      ...(due !== undefined ? {due: due ? parseIsoDateUtc(due) : null} : {}),
    },
  });
  return c.json(await loadState(userId));
});

goalsRoutes.delete('/goals/:id', async (c) => {
  const userId = c.get('userId');
  const goal = await prisma.goal.findFirst({where: {id: c.req.param('id'), userId}});
  if (!goal) return c.json({error: 'Not found'}, 404);
  await prisma.$transaction(async (tx) => {
    // Deleting a goal returns its saved money to the balance (catalog §3.5).
    await tx.profile.update({
      where: {userId},
      data: {primaryBalance: {increment: goal.saved}},
    });
    if (Number(goal.saved) > 0) {
      await tx.txn.create({
        data: {
          userId,
          label: `Returned from ${goal.name}`,
          amount: goal.saved,
          cat: 'Income',
          postedAt: new Date(),
          src: 'Main checking',
        },
      });
    }
    await tx.goal.delete({where: {id: goal.id}});
  });
  return c.json(await loadState(userId));
});
