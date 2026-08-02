import {zValidator} from '@hono/zod-validator';
import {onboardingCompleteSchema} from '@runway/shared';
import {Hono} from 'hono';
import {loadState} from '../services/app-state';
import {completeOnboarding} from '../services/complete-onboarding';
import {resetToDemoData} from '../services/reset-demo';

export const onboardingRoutes = new Hono();

onboardingRoutes.post(
  '/onboarding/complete',
  zValidator('json', onboardingCompleteSchema),
  async (c) => {
    const userId = c.get('userId');
    await completeOnboarding(userId, c.req.valid('json'));
    return c.json(await loadState(userId));
  },
);

onboardingRoutes.post('/reset-demo', async (c) => {
  const userId = c.get('userId');
  await resetToDemoData(userId);
  return c.json(await loadState(userId));
});
