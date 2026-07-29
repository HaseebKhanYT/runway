import {zValidator} from '@hono/zod-validator';
import type {Prisma} from '@prisma/client';
import {cardLogPaymentSchema, cardUpsertSchema, suggestRewards} from '@runway/shared';
import {Hono} from 'hono';
import {prisma} from '../db';
import {syncCardBill} from '../card_bill_sync';
import {loadState} from '../state';

export const cardsRoutes = new Hono();

function promoEndFromMonths(months: number | null | undefined): Date | null {
  if (months == null) return null;
  const d = new Date();
  d.setDate(d.getDate() + months * 30);
  return d;
}

cardsRoutes.post('/cards', zValidator('json', cardUpsertSchema), async (c) => {
  const userId = c.get('userId');
  const {promoMonths, rewards, ...body} = c.req.valid('json');
  const card = await prisma.$transaction(async (tx) => {
    const created = await tx.card.create({
      data: {
        userId,
        ...body,
        // Empty rewards -> guess from the nickname (catalog §1.6).
        rewards: (rewards.length > 0
          ? rewards
          : suggestRewards(body.name)) as unknown as Prisma.InputJsonValue,
        promoEnd: promoEndFromMonths(promoMonths),
        balanceUpdatedAt: new Date(),
      },
    });
    await syncCardBill(tx, userId, created.id);
    return created;
  });
  void card;
  return c.json(await loadState(userId));
});

cardsRoutes.patch('/cards/:id', zValidator('json', cardUpsertSchema.partial()), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const {promoMonths, ...body} = c.req.valid('json');
  await prisma.$transaction(async (tx) => {
    const existing = await tx.card.findFirst({where: {id, userId}});
    if (!existing) return;
    await tx.card.update({
      where: {id},
      data: {
        ...body,
        ...(promoMonths !== undefined ? {promoEnd: promoEndFromMonths(promoMonths)} : {}),
        ...(body.balance !== undefined ? {balanceUpdatedAt: new Date()} : {}),
      },
    });
    await syncCardBill(tx, userId, id);
  });
  return c.json(await loadState(userId));
});

cardsRoutes.delete('/cards/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  await prisma.$transaction(async (tx) => {
    await tx.bill.deleteMany({where: {userId, cardId: id}});
    await tx.card.deleteMany({where: {id, userId}});
  });
  return c.json(await loadState(userId));
});

cardsRoutes.post(
  '/cards/:id/log-payment',
  zValidator('json', cardLogPaymentSchema),
  async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const {amount, source} = c.req.valid('json');
    await prisma.$transaction(async (tx) => {
      const card = await tx.card.findFirst({where: {id, userId}});
      if (!card) return;
      await tx.card.update({
        where: {id},
        data: {balance: {decrement: amount}, balanceUpdatedAt: new Date()},
      });
      let src = 'Main checking';
      if (source !== 'checking') {
        const account = await tx.account.findFirst({where: {id: source, userId}});
        if (account) {
          await tx.account.update({
            where: {id: account.id},
            data: {balance: {decrement: amount}},
          });
          src = account.name;
        }
      } else {
        await tx.profile.update({
          where: {userId},
          data: {primaryBalance: {decrement: amount}},
        });
      }
      await tx.txn.create({
        data: {
          userId,
          label: `${card.name} payment`,
          amount: -amount,
          cat: 'Debt',
          postedAt: new Date(),
          src,
          cardId: card.id,
        },
      });
      await syncCardBill(tx, userId, id);
    });
    return c.json(await loadState(userId));
  },
);
