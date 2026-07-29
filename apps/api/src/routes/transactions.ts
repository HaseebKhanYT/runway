import {zValidator} from '@hono/zod-validator';
import {txnCategoryPatchSchema} from '@runway/shared';
import {Hono} from 'hono';
import {prisma} from '../db';
import {loadState} from '../state';

export const transactionsRoutes = new Hono();

// Soft delete — "record only": balances are deliberately left alone (catalog §2.2).
transactionsRoutes.delete('/transactions/:id', async (c) => {
  const userId = c.get('userId');
  await prisma.txn.updateMany({
    where: {id: c.req.param('id'), userId},
    data: {deletedAt: new Date()},
  });
  return c.json(await loadState(userId));
});

transactionsRoutes.post('/transactions/:id/restore', async (c) => {
  const userId = c.get('userId');
  await prisma.txn.updateMany({
    where: {id: c.req.param('id'), userId},
    data: {deletedAt: null},
  });
  return c.json(await loadState(userId));
});

transactionsRoutes.delete('/transactions/:id/purge', async (c) => {
  const userId = c.get('userId');
  await prisma.txn.deleteMany({
    where: {id: c.req.param('id'), userId, deletedAt: {not: null}},
  });
  return c.json(await loadState(userId));
});

transactionsRoutes.post('/transactions/trash/clear', async (c) => {
  const userId = c.get('userId');
  await prisma.txn.deleteMany({where: {userId, deletedAt: {not: null}}});
  return c.json(await loadState(userId));
});

// Recategorize a spending txn: moves the spent amount between categories.
transactionsRoutes.patch(
  '/transactions/:id/category',
  zValidator('json', txnCategoryPatchSchema),
  async (c) => {
    const userId = c.get('userId');
    const {category} = c.req.valid('json');
    await prisma.$transaction(async (tx) => {
      const txn = await tx.txn.findFirst({where: {id: c.req.param('id'), userId}});
      if (!txn || Number(txn.amount) >= 0) return;
      const spent = -Number(txn.amount);
      const from = await tx.category.findFirst({where: {userId, name: txn.cat}});
      const to = await tx.category.findFirst({where: {userId, name: category}});
      if (!to) return;
      if (from) {
        await tx.category.update({where: {id: from.id}, data: {spent: {decrement: spent}}});
      }
      await tx.category.update({where: {id: to.id}, data: {spent: {increment: spent}}});
      await tx.txn.update({where: {id: txn.id}, data: {cat: to.name}});
    });
    return c.json(await loadState(userId));
  },
);
