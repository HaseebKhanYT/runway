import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {isAllowedOrigin, originRules} from './lib/origins';
import {authMiddleware} from './middleware/auth';
import {ensureUser, loadState} from './services/app-state';
import {accountsRoutes} from './routes/accounts';
import {billsRoutes} from './routes/bills';
import {categoriesRoutes} from './routes/categories';
import {crunchRoutes} from './routes/crunch';
import {expensesRoutes} from './routes/expenses';
import {cardsRoutes} from './routes/cards';
import {goalsRoutes} from './routes/goals';
import {loansRoutes} from './routes/loans';
import {onboardingRoutes} from './routes/onboarding';
import {paydayRoutes} from './routes/payday';
import {plannerRoutes} from './routes/planner';
import {plaidRoutes} from './routes/plaid';
import {transactionsRoutes} from './routes/transactions';

export const app = new Hono();

/**
 * Browser origins allowed to call this API: the exact origins in `WEB_ORIGIN`,
 * plus anything matching a glob in `WEB_ORIGIN_PREVIEW`. Both are read once at
 * boot, and `lib/origins.ts` documents why the second exists. With neither set,
 * only the local dev web app is allowed.
 */
const rules = originRules(process.env);

app.use(
  '*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin, rules) ? origin : null),
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
app.route('/', crunchRoutes);
app.route('/', expensesRoutes);
app.route('/', loansRoutes);
app.route('/', onboardingRoutes);
app.route('/', paydayRoutes);
app.route('/', plannerRoutes);
app.route('/', plaidRoutes);
