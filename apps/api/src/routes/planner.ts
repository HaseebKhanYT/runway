import {zValidator} from '@hono/zod-validator';
import {plannerStartSchema} from '@runway/shared';
import {Hono} from 'hono';
import {loadState} from '../services/app-state';
import {startPlan} from '../services/start-plan';

export const plannerRoutes = new Hono();

plannerRoutes.post('/planner/start', zValidator('json', plannerStartSchema), async (c) => {
  const userId = c.get('userId');
  await startPlan(userId, c.req.valid('json'));
  return c.json(await loadState(userId));
});
