import {zValidator} from '@hono/zod-validator';
import {categoryUpsertSchema} from '@runway/shared';
import {Hono} from 'hono';
import {prisma} from '../lib/db';
import {loadState} from '../services/app-state';

export const categoriesRoutes = new Hono();

categoriesRoutes.post('/categories', zValidator('json', categoryUpsertSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const max = await prisma.category.aggregate({where: {userId}, _max: {sortOrder: true}});
  await prisma.category.create({
    data: {userId, ...body, sortOrder: (max._max.sortOrder ?? -1) + 1},
  });
  return c.json(await loadState(userId));
});

categoriesRoutes.patch(
  '/categories/:id',
  zValidator('json', categoryUpsertSchema.partial()),
  async (c) => {
    const userId = c.get('userId');
    await prisma.category.updateMany({
      where: {id: c.req.param('id'), userId},
      data: c.req.valid('json'),
    });
    return c.json(await loadState(userId));
  },
);

categoriesRoutes.delete('/categories/:id', async (c) => {
  const userId = c.get('userId');
  const cat = await prisma.category.findFirst({where: {id: c.req.param('id'), userId}});
  if (!cat) return c.json({error: 'Not found'}, 404);
  if (cat.locked) return c.json({error: 'Uncategorized is locked'}, 400);
  await prisma.$transaction(async (tx) => {
    // Deleted categories re-point their spending to Uncategorized.
    await tx.txn.updateMany({where: {userId, cat: cat.name}, data: {cat: 'Uncategorized'}});
    const unc = await tx.category.findFirst({where: {userId, locked: true}});
    if (unc) {
      await tx.category.update({
        where: {id: unc.id},
        data: {spent: {increment: cat.spent}},
      });
    }
    await tx.category.delete({where: {id: cat.id}});
  });
  return c.json(await loadState(userId));
});
