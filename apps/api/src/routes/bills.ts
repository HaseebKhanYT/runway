import {zValidator} from '@hono/zod-validator';
import {billCreateSchema, billPatchSchema} from '@runway/shared';
import {Hono} from 'hono';
import {prisma} from '../lib/db';
import {nextDueDate} from '../lib/dates';
import {loadState} from '../services/app-state';

export const billsRoutes = new Hono();

billsRoutes.post('/bills', zValidator('json', billCreateSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  await prisma.bill.create({
    data: {
      userId,
      name: body.name,
      amount: body.amount,
      kind: body.kind,
      cycle: body.cycle,
      dueDate: nextDueDate(body.dueDay, new Date()),
      payFrom: body.payFrom ?? null,
    },
  });
  return c.json(await loadState(userId));
});

billsRoutes.patch('/bills/:id', zValidator('json', billPatchSchema), async (c) => {
  const userId = c.get('userId');
  const {dueDay, ...rest} = c.req.valid('json');
  await prisma.bill.updateMany({
    where: {id: c.req.param('id'), userId},
    data: {
      ...rest,
      ...(dueDay !== undefined ? {dueDate: nextDueDate(dueDay, new Date())} : {}),
    },
  });
  return c.json(await loadState(userId));
});

billsRoutes.delete('/bills/:id', async (c) => {
  const userId = c.get('userId');
  await prisma.bill.deleteMany({where: {id: c.req.param('id'), userId}});
  return c.json(await loadState(userId));
});
