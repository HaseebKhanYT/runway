# Runway

Your runway to financial independence. One number tells you what's safe to
spend, every day — after bills, after goals.

## Stack

pnpm + Turborepo monorepo:

| Package | What it is |
|---|---|
| `apps/web` | Next.js 15 (App Router) frontend, Clerk auth, TanStack Query |
| `apps/api` | Hono REST API — Clerk JWT verification, Prisma, transactional money flows |
| `packages/shared` | Pure domain math (safe-per-day, goals, cards, crunch, planner), Zod schemas, formatting — used by both apps |

Postgres 16 runs in Docker. Design spec and the pixel-fidelity catalog live in
`docs/superpowers/specs/`; the implementation plan in `docs/superpowers/plans/`.

## Getting started

```bash
pnpm install
docker compose up -d            # Postgres on localhost:5433
cp .env.example .env            # fill in values (see below)
pnpm --filter @runway/api exec prisma migrate dev
pnpm dev                        # api :8787 + web :3000
```

### Environment

- `DATABASE_URL` — preconfigured for the docker-compose Postgres.
- Clerk: with no keys set, `apps/web` runs in Clerk **keyless dev mode** and
  prints a claim URL on boot. Copy the generated secret from
  `apps/web/.clerk/.tmp/keyless.json` into `apps/api/.env` as
  `CLERK_SECRET_KEY` so the API can verify sessions. For a real Clerk app, set
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in both apps.
- `apps/web/.env.local` also sets `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and
  `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` so Clerk uses the themed in-app
  auth pages.

## Tests

```bash
pnpm test         # shared domain math (52) + api flows (21), Vitest
pnpm typecheck
```

API tests run against the dev database using `DEV_AUTH_BYPASS=1` (an
`x-dev-user` header stands in for a Clerk session; never enable in
production). The e2e happy path lives in `e2e/smoke.spec.ts` — see its header
for how to run it against the dev servers.

## Plaid (reserved)

Plaid is not integrated yet, but the space is reserved:

- `apps/api/src/routes/plaid.ts` — link-token / exchange / webhook endpoints
  returning 501
- `Account.plaidItemId/plaidAccountId/plaidAccessToken` and
  `Txn.plaidTransactionId` columns
- `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` in `.env.example`
- The Accounts modal shows a disabled "Connect a bank — coming soon" row
