import {zValidator} from '@hono/zod-validator';
import {paydayConfirmSchema} from '@runway/shared';
import {Hono} from 'hono';
import {loadState} from '../services/app-state';
import {confirmPayday} from '../services/payday';

export const paydayRoutes = new Hono();

paydayRoutes.post('/payday/confirm', zValidator('json', paydayConfirmSchema), async (c) => {
  const userId = c.get('userId');
  const {amount} = c.req.valid('json');
  await confirmPayday(userId, amount);
  return c.json(await loadState(userId));
});
