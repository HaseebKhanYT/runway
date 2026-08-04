import {beforeAll, describe, expect, it} from 'vitest';

/**
 * The wiring, not the rule: `app.ts` reads the environment once at import, so
 * this file sets it and then imports the app, and asks the assembled Hono app
 * what it answers. No database is touched — a preflight never reaches a route.
 */
const ALIAS = 'https://runway-git-develop-acme.vercel.app';
const DEPLOYMENT = 'https://runway-dbjw4aj53-acme.vercel.app';

let app: typeof import('../../src/app').app;

beforeAll(async () => {
  process.env.WEB_ORIGIN = ALIAS;
  process.env.WEB_ORIGIN_PREVIEW = 'https://runway-*-acme.vercel.app';
  ({app} = await import('../../src/app'));
});

async function preflight(origin: string): Promise<string | null> {
  const res = await app.request('/me/state', {
    method: 'OPTIONS',
    headers: {origin, 'access-control-request-method': 'GET'},
  });
  return res.headers.get('access-control-allow-origin');
}

describe('CORS', () => {
  it('echoes an origin named exactly', async () => {
    expect(await preflight(ALIAS)).toBe(ALIAS);
  });

  it('echoes a preview deployment hostname, which no exact list could name', async () => {
    expect(await preflight(DEPLOYMENT)).toBe(DEPLOYMENT);
  });

  it('sends no allow-origin header to anywhere else, which is what a browser blocks on', async () => {
    expect(await preflight('https://evil.example')).toBeNull();
  });
});
