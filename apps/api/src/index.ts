import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {authMiddleware} from './auth';
import {ensureUser, loadState} from './state';
import {accountsRoutes} from './routes/accounts';
import {billsRoutes} from './routes/bills';
import {categoriesRoutes} from './routes/categories';
import {cardsRoutes} from './routes/cards';
import {flowsRoutes} from './routes/flows';
import {goalsRoutes} from './routes/goals';
import {onboardingRoutes} from './routes/onboarding';
import {plaidRoutes} from './routes/plaid';
import {transactionsRoutes} from './routes/transactions';

export const app = new Hono();

app.use(
  '*',
  cors({
    origin: ['http://localhost:3000'],
    allowHeaders: ['Authorization', 'Content-Type', 'x-dev-user'],
  }),
);

app.get('/health', (c) => c.json({ok: true}));

app.use('/me/*', authMiddleware);
app.use('/accounts/*', authMiddleware);
app.use('/accounts', authMiddleware);
app.use('/bills/*', authMiddleware);
app.use('/bills', authMiddleware);
app.use('/categories/*', authMiddleware);
app.use('/categories', authMiddleware);
app.use('/goals/*', authMiddleware);
app.use('/goals', authMiddleware);
app.use('/cards/*', authMiddleware);
app.use('/cards', authMiddleware);
app.use('/transactions/*', authMiddleware);
app.use('/profile', authMiddleware);
app.use('/payday/*', authMiddleware);
app.use('/expenses', authMiddleware);
app.use('/crunch/*', authMiddleware);
app.use('/loans', authMiddleware);
app.use('/planner/*', authMiddleware);
app.use('/onboarding/*', authMiddleware);
app.use('/reset-demo', authMiddleware);
app.use('/plaid/*', authMiddleware);

app.get('/me/state', async (c) => {
  const userId = c.get('userId');
  await ensureUser(userId);
  return c.json(await loadState(userId));
});

app.route('/', accountsRoutes);
app.route('/', billsRoutes);
app.route('/', categoriesRoutes);
app.route('/', goalsRoutes);
app.route('/', cardsRoutes);
app.route('/', transactionsRoutes);
app.route('/', flowsRoutes);
app.route('/', onboardingRoutes);
app.route('/', plaidRoutes);

const PORT = Number(process.env.PORT ?? 8787);

if (process.env.NODE_ENV !== 'test') {
  serve({fetch: app.fetch, port: PORT});
  console.log(`runway api listening on :${PORT}`);
}
