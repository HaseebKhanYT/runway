/**
 * Runway happy-path smoke test.
 *
 * Prerequisites (not run by `pnpm test` — needs live servers):
 *   1. docker compose up -d
 *   2. DEV_AUTH_BYPASS=1 pnpm --filter @runway/api dev
 *   3. pnpm --filter @runway/web dev
 *   4. pnpm add -D -w @playwright/test && npx playwright install chromium
 *   5. npx playwright test e2e/smoke.spec.ts
 *
 * Auth: this spec exercises the API directly with the DEV_AUTH_BYPASS header
 * (an x-dev-user header stands in for a Clerk session) and checks the signed
 * out web shell. The full Clerk sign-up → onboarding → dashboard pass was run
 * interactively via the Chrome MCP smoke test; automating it needs a Clerk
 * test token (see Clerk docs on testing) which keyless dev mode does not mint.
 */
import {expect, test} from '@playwright/test';

const API = 'http://localhost:8787';
const USER = 'e2e-smoke-user';

function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      'x-dev-user': USER,
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
}

test('web redirects signed-out visitors to sign-in', async ({page}) => {
  await page.goto('http://localhost:3000/runway');
  await expect(page).toHaveURL(/sign-in/);
});

test('api happy path: demo -> expense -> pay bill -> payday', async () => {
  let res = await api('/reset-demo', {method: 'POST'});
  expect(res.status).toBe(200);
  let state = await res.json();
  expect(state.profile.primaryBalance).toBe(6000);
  expect(state.bills).toHaveLength(7);

  res = await api('/expenses', {
    method: 'POST',
    body: JSON.stringify({kind: 'expense', amount: 25, category: 'Eating out', source: 'checking'}),
  });
  state = await res.json();
  expect(state.profile.primaryBalance).toBe(5975);

  const rent = state.bills.find((b: {name: string}) => b.name === 'Rent');
  res = await api(`/bills/${rent.id}/pay`, {
    method: 'POST',
    body: JSON.stringify({source: 'checking'}),
  });
  state = await res.json();
  expect(state.profile.primaryBalance).toBe(5025);
  expect(state.bills.find((b: {id: string}) => b.id === rent.id).paid).toBe(true);

  res = await api('/payday/confirm', {method: 'POST', body: JSON.stringify({amount: 1700})});
  state = await res.json();
  expect(state.bills.every((b: {paid: boolean}) => !b.paid)).toBe(true);
  expect(state.txns.some((t: {label: string}) => t.label === 'Paycheck')).toBe(true);
});
