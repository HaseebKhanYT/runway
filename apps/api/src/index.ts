import {serve} from '@hono/node-server';
import {app} from './app';

const PORT = Number(process.env.PORT ?? 8787);

/**
 * Refuse to boot a production instance that is missing its signing key or that
 * still has the test-only auth bypass switched on — either would leave every
 * user's data reachable without a valid session.
 */
function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  if (!process.env.CLERK_SECRET_KEY) problems.push('CLERK_SECRET_KEY is not set');
  if (process.env.DEV_AUTH_BYPASS === '1') problems.push('DEV_AUTH_BYPASS must not be enabled');
  if (!process.env.WEB_ORIGIN) problems.push('WEB_ORIGIN is not set');
  if (problems.length > 0) {
    throw new Error(`Refusing to start in production: ${problems.join('; ')}`);
  }
}

assertProductionConfig();
serve({fetch: app.fetch, port: PORT});
console.log(`runway api listening on :${PORT}`);
