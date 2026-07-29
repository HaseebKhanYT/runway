import {Hono} from 'hono';

/**
 * Reserved space for the Plaid integration (spec §6).
 *
 * Planned shape:
 *  - POST /plaid/link-token  -> create a Link token for the client
 *  - POST /plaid/exchange    -> exchange public_token, store access token on Account
 *  - POST /plaid/webhook     -> transaction/balance sync webhooks
 *
 * Account rows carry plaidItemId/plaidAccountId/plaidAccessToken columns and
 * Txn rows carry plaidTransactionId; env vars PLAID_CLIENT_ID / PLAID_SECRET /
 * PLAID_ENV are declared in .env.example.
 */
export const plaidRoutes = new Hono();

const NOT_IMPLEMENTED = {error: 'Plaid integration reserved — not implemented'};

plaidRoutes.post('/plaid/link-token', (c) => c.json(NOT_IMPLEMENTED, 501));
plaidRoutes.post('/plaid/exchange', (c) => c.json(NOT_IMPLEMENTED, 501));
plaidRoutes.post('/plaid/webhook', (c) => c.json(NOT_IMPLEMENTED, 501));
