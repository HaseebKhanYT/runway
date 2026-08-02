import {zValidator} from '@hono/zod-validator';
import {accountUpsertSchema, profilePatchSchema} from '@runway/shared';
import {Hono} from 'hono';
import {prisma} from '../lib/db';
import {parseIsoDateUtc} from '../lib/dates';
import {loadState} from '../services/app-state';

export const accountsRoutes = new Hono();

accountsRoutes.post('/accounts', zValidator('json', accountUpsertSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  await prisma.account.create({
    data: {
      userId,
      name: body.name,
      type: body.type,
      balance: body.balance,
      logo: body.logo ?? null,
    },
  });
  return c.json(await loadState(userId));
});

accountsRoutes.patch(
  '/accounts/:id',
  zValidator('json', accountUpsertSchema.partial()),
  async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    await prisma.account.updateMany({where: {id: c.req.param('id'), userId}, data: body});
    return c.json(await loadState(userId));
  },
);

accountsRoutes.delete('/accounts/:id', async (c) => {
  const userId = c.get('userId');
  await prisma.account.deleteMany({where: {id: c.req.param('id'), userId}});
  return c.json(await loadState(userId));
});

accountsRoutes.patch('/profile', zValidator('json', profilePatchSchema), async (c) => {
  const userId = c.get('userId');
  const {nextPay, ...rest} = c.req.valid('json');
  await prisma.profile.update({
    where: {userId},
    data: {
      ...rest,
      ...(nextPay !== undefined ? {nextPay: nextPay ? parseIsoDateUtc(nextPay) : null} : {}),
    },
  });
  return c.json(await loadState(userId));
});
