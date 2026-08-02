import {zValidator} from '@hono/zod-validator';
import {expenseCreateSchema} from '@runway/shared';
import {Hono} from 'hono';
import {loadState} from '../services/app-state';
import {logExpense} from '../services/log-expense';

export const expensesRoutes = new Hono();

expensesRoutes.post('/expenses', zValidator('json', expenseCreateSchema), async (c) => {
  const userId = c.get('userId');
  await logExpense(userId, c.req.valid('json'));
  return c.json(await loadState(userId));
});
