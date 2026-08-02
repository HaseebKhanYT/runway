import {zValidator} from '@hono/zod-validator';
import {crunchLockSchema} from '@runway/shared';
import {Hono} from 'hono';
import {loadState} from '../services/app-state';
import {lockCrunchPlan} from '../services/crunch-lock';

export const crunchRoutes = new Hono();

crunchRoutes.post('/crunch/lock', zValidator('json', crunchLockSchema), async (c) => {
  const userId = c.get('userId');
  const {pausedGoalIds, cardId, advance} = c.req.valid('json');
  await lockCrunchPlan(userId, pausedGoalIds, cardId, advance);
  return c.json(await loadState(userId));
});
