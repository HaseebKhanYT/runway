# Runway

Your runway to financial independence. One number tells you what's safe to
spend, every day — after bills, after goals.

## Stack

pnpm + Turborepo monorepo:

| Package           | What it is                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 15 (App Router) frontend, Clerk auth, TanStack Query                                                |
| `apps/api`        | Hono REST API — Clerk JWT verification, Prisma, transactional money flows                                   |
| `packages/shared` | Pure domain math (safe-per-day, goals, cards, crunch, planner), Zod schemas, formatting — used by both apps |

Postgres 16 runs in Docker.

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
`x-dev-user` header stands in for a Clerk session). The bypass is ignored
whenever `NODE_ENV=production`, and the API refuses to boot in production if
it is set at all.

## Deployment

`apps/web` → Vercel. `apps/api` + Postgres → Railway. Both auto-deploy from
`main`.

```bash
pnpm build     # verify both production builds before deploying
```

### Railway (API + database)

Add a Postgres database, then a service pointed at this repo. `railway.json`
supplies the build/start commands and the `/health` check, so only environment
variables need setting:

| Variable           | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| `DATABASE_URL`     | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `CLERK_SECRET_KEY` | Clerk production secret (`sk_live_…`)                         |
| `WEB_ORIGIN`       | the deployed web origin, e.g. `https://example.com`           |
| `NODE_ENV`         | `production`                                                  |

`WEB_ORIGIN` is required: it is both the CORS allowlist and the set of
authorized parties for Clerk token verification, so a token minted for another
application is rejected. Multiple origins are comma-separated.

The start command runs `prisma migrate deploy` before booting, so schema
changes apply on release.

### Vercel (web)

Create a project from this repo with **Root Directory** set to `apps/web` —
Vercel then installs from the pnpm workspace root automatically.

| Variable                                          | Value                                 |
| ------------------------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_API_URL`                             | the deployed Railway API origin       |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Clerk production key (`pk_live_…`)    |
| `CLERK_SECRET_KEY`                                | Clerk production secret (`sk_live_…`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | `/sign-in`                            |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | `/sign-up`                            |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/runway`                             |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/runway`                             |

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time —
changing one requires a redeploy, not just an env var edit.

### Clerk production instance

A production instance requires a custom domain: Clerk issues DNS records
(including a `CNAME` for its Frontend API) that must be added at your
registrar, and production keys only work on that domain. Create the production
instance from the Clerk dashboard, add its DNS records, then use its `pk_live_`
/ `sk_live_` keys above. Until DNS verifies, the dev instance keys keep
working on localhost.

## Plaid (reserved)

Plaid is not integrated yet, but the space is reserved:

- `apps/api/src/routes/plaid.ts` — link-token / exchange / webhook endpoints
  returning 501
- `Account.plaidItemId/plaidAccountId/plaidAccessToken` and
  `Txn.plaidTransactionId` columns
- `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` in `.env.example`
- The Accounts modal shows a disabled "Connect a bank — coming soon" row
