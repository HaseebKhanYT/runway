import {zValidator} from '@hono/zod-validator';
import {loanCreateSchema} from '@runway/shared';
import {Hono} from 'hono';
import {loadState} from '../services/app-state';
import {recordFriendLoan} from '../services/friend-loan';

export const loansRoutes = new Hono();

loansRoutes.post('/loans', zValidator('json', loanCreateSchema), async (c) => {
  const userId = c.get('userId');
  const {who, amount, dueDate} = c.req.valid('json');
  await recordFriendLoan(userId, who, amount, dueDate);
  return c.json(await loadState(userId));
});
