# Runway

> Your runway to financial independence. One number tells you what's safe to
> spend, every day — after bills, after goals.

[![CI](https://github.com/HaseebKhanYT/runway/actions/workflows/ci.yml/badge.svg)](https://github.com/HaseebKhanYT/runway/actions/workflows/ci.yml)

Runway takes your balances, your bills and your goals and reduces them to a
single number: what is safe to spend today. It is a web application, not a
library — there is nothing to install as a dependency.

## Table of contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [Status and contact](#status-and-contact)
- [License](#license)

## Overview

Budgeting apps tend to answer "where did the money go?". Runway answers the
question you actually have standing in a shop: _can I spend this?_

It does that by treating upcoming bills and funded goals as money that is
already committed, subtracting them from what is on hand, and dividing the
remainder across the days until income next arrives. The result is one
safe-to-spend-per-day figure that updates as money moves.

## Tech stack

pnpm + Turborepo monorepo:

| Package           | What it is                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `apps/web`        | Next.js 15 (App Router) frontend, Clerk auth, TanStack Query                                       |
| `apps/api`        | Hono REST API — Clerk JWT verification, Prisma, transactional money flows                          |
| `packages/shared` | Pure domain math (runway, cycles, goals, cards), Zod schemas, the demo fixture — used by both apps |

Postgres 16 runs in Docker. `.nvmrc` pins Node 24, and both Vercel and
Railway's Railpack read it, so it is the single source of truth for the runtime
version across CI and both platforms.

## Architecture

```
                  ┌───────────────────────┐
   browser ──────▶│  apps/web  (Next.js)  │
                  └───────────┬───────────┘
                              │  HTTPS, Clerk session token
                              ▼
                  ┌───────────────────────┐        ┌──────────────┐
                  │  apps/api  (Hono)     │───────▶│  Postgres 16 │
                  └───────────┬───────────┘ Prisma └──────────────┘
                              │
                  ┌───────────▼───────────┐
                  │   packages/shared     │  ◀── also imported by apps/web
                  └───────────────────────┘
```

Three properties are worth knowing before reading the code:

- **The money math lives in `packages/shared`, not in either app.** Both the
  API and the web client import the same pure functions, so a figure rendered
  in the UI and the same figure computed server-side cannot drift.
- **The API verifies Clerk tokens itself.** `WEB_ORIGIN` is both the CORS
  allowlist and the set of authorized parties for token verification, so a
  token minted for a different Clerk application is rejected rather than
  trusted.
- **`packages/shared` ships raw TypeScript**, not a build artifact. There is no
  compile step between editing a domain function and running it.

## Repository layout

The layout follows one rule per package (decided in
[#40](https://github.com/HaseebKhanYT/runway/issues/40)): the API layers HTTP
apart from money movement, shared holds only what both apps consume, and all
presentation — copy strings, colors, screen geometry — belongs to the web app.

```
apps/api/src
├── index.ts        boot only: assert production config, listen
├── app.ts          Hono assembly: CORS, auth, route mounting
├── middleware/     Clerk JWT verification (auth.ts)
├── lib/            db (Prisma client), dates
├── routes/         one file per resource — validate, call a service, return state
└── services/       one file per money flow or invariant; every Prisma
                    transaction that moves money lives here (pay-bill, payday,
                    log-expense, set-aside, crunch-lock, friend-loan,
                    start-plan, complete-onboarding, reset-demo,
                    log-card-payment, card-bill-sync, payment-source, app-state)

packages/shared/src
├── types.ts        wire types, pure declarations
├── schemas.ts      Zod input schemas
├── cycles.ts       pay-cadence math (cycle length, days-until)
├── runway.ts       the safe-per-day formula and pooled balance
├── goals.ts        goal set-aside math
├── cards.ts        effective APR, amortization, reward suggestions
├── categories.ts   the category palette
└── demo-data.ts    the demo fixture (seeds /reset-demo, fixtures web tests)

apps/web/src
├── app/            Next.js App Router pages
├── components/     React components by area (dashboard, modals, shell, …)
└── lib/            api client, queries — plus the presentation modules:
                    format (money/date formatters), view-model, timeline,
                    card-lines, crunch, planner, category-colors
```

A route file never opens a transaction, and a service never parses HTTP. In
`packages/shared` there are no UI strings and no hex colors; if a function
builds a sentence or picks a color, it lives in `apps/web/src/lib`.

## Getting started

### Prerequisites

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 9
- Docker, for Postgres

### Setup

```bash
pnpm install
docker compose up -d            # Postgres on localhost:5433
cp .env.example .env            # fill in values (see Configuration)
pnpm --filter @runway/api exec prisma migrate dev
```

### Running locally

```bash
pnpm dev                        # api :8787 + web :3000
```

## Configuration

| Variable                                          | Where      | Required     | Notes                                         |
| ------------------------------------------------- | ---------- | ------------ | --------------------------------------------- |
| `DATABASE_URL`                                    | `apps/api` | yes          | Preconfigured for the docker-compose Postgres |
| `CLERK_SECRET_KEY`                                | both apps  | yes          | See keyless dev mode below                    |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | `apps/web` | yes          | See keyless dev mode below                    |
| `NEXT_PUBLIC_API_URL`                             | `apps/web` | deploys only | Which API a build talks to                    |
| `WEB_ORIGIN`                                      | `apps/api` | deploys only | CORS allowlist; comma-separated               |
| `PORT`                                            | `apps/api` | no           | Defaults to `8787`                            |
| `DEV_AUTH_BYPASS`                                 | `apps/api` | no           | Integration tests only; inert in production   |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | `apps/web` | no           | `/sign-in`                                    |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | `apps/web` | no           | `/sign-up`                                    |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `apps/web` | no           | `/runway`                                     |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `apps/web` | no           | `/runway`                                     |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV`  | `apps/api` | no           | Reserved, not yet integrated                  |

With no Clerk keys set, `apps/web` runs in Clerk **keyless dev mode** and prints
a claim URL on boot. Copy the generated secret from
`apps/web/.clerk/.tmp/keyless.json` into `apps/api/.env` as `CLERK_SECRET_KEY`
so the API can verify sessions. For a real Clerk app, set
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in both apps.

`apps/web/.env.local` also sets the two sign-in/sign-up URL variables so Clerk
uses the themed in-app auth pages rather than its hosted ones.

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time —
changing one requires a redeploy, not just an env var edit.

## Testing

The suite is split by whether it needs a database:

```bash
pnpm test              # DB-free: shared math (28) + api pure modules (19) + web presentation (28)
pnpm test:integration  # needs Postgres: api flows (21)
pnpm typecheck
```

`pnpm test` is the one that matters for a fresh clone — it passes with no
Docker running and no `DATABASE_URL` set, which is what lets CI verify a PR
without provisioning a database. Vitest 2.1.9 predates `projects`, so the split
is carried by separate config files, and the partition lives entirely in their
include globs:

| Config                                  | Glob                     |                   |
| --------------------------------------- | ------------------------ | ----------------- |
| `packages/shared/vitest.config.ts`      | `test/**/*.test.ts`      | recursive         |
| `apps/web/vitest.config.ts`             | `test/**/*.test.ts`      | recursive         |
| `apps/api/vitest.unit.config.ts`        | `test/unit/**/*.test.ts` | recursive         |
| `apps/api/vitest.integration.config.ts` | `test/*.test.ts`         | **not** recursive |

The non-recursive integration glob is what keeps `test/unit/` out of it. A new
`apps/api` test therefore belongs in `test/unit/` (no database) or directly in
`test/` (database) — a subdirectory other than `unit/` is run by neither.

All four configs pin `TZ: 'UTC'`, because several modules read local date
parts. `apps/api/test/unit/dates.test.ts` opens with a tripwire asserting the
pin took effect, so a config regression fails loudly instead of silently
changing what the tests mean.

The pin has to live in the config rather than the environment. turbo runs tasks
in strict env mode, so a `TZ` exported by a shell or by a CI job is filtered out
before vitest starts unless it is declared in `turbo.json`.

`prisma generate` is wired as a turbo task dependency (`@runway/api#db:generate`)
rather than a `pre*` script, since pnpm 9 does not run those by default. It
cannot be cached: Prisma writes into `node_modules/.pnpm/…/.prisma/client`,
outside the package, so turbo has no output to declare.

Integration tests run against the dev database using `DEV_AUTH_BYPASS=1` (an
`x-dev-user` header stands in for a Clerk session). The bypass is ignored
whenever `NODE_ENV=production`, and the API refuses to boot in production if
it is set at all.

## Deployment

`apps/web` → Vercel. `apps/api` + Postgres → Railway. Each has two environments,
driven by branch:

| Branch    | Vercel                 | Railway                          | Clerk instance |
| --------- | ---------------------- | -------------------------------- | -------------- |
| `main`    | Production             | `production` environment         | Production     |
| `develop` | Preview (branch alias) | `staging` environment            | Development    |
| PR branch | Preview                | — (calls staging, CORS-rejected) | Development    |

The staging URL is the Vercel branch alias for `develop`, behind Vercel's SSO
gate. There is no custom domain for it and no DNS work.

Pull request previews build and render, but their API calls are rejected by the
staging API's CORS allowlist, which only names the `develop` alias. That is
accepted rather than fixed: it keeps `WEB_ORIGIN` a closed list.

```bash
pnpm build     # verify both production builds before deploying
```

Never run `vercel --prod` from a working tree. Production is whatever `main`
builds; a local promote silently detaches production from the branch, and on
the Hobby plan `vercel promote` / `vercel rollback` are not available to undo
it. Merging the release PR is the only way production changes.

### Railway (API + database)

Two **environments** in one project, `production` and `staging`, each with its
own `runway` service, its own `Postgres`, its own private network and its own
volume. `railway.json` at the repo root applies to both, so it supplies the
build/start commands and the `/health` check and only variables differ:

| Variable           | `production`                 | `staging`                          |
| ------------------ | ---------------------------- | ---------------------------------- |
| `DATABASE_URL`     | `${{Postgres.DATABASE_URL}}` | same reference, different database |
| `CLERK_SECRET_KEY` | `sk_live_…`                  | `sk_test_…`                        |
| `WEB_ORIGIN`       | the production web origin    | the Vercel `develop` branch alias  |
| `NODE_ENV`         | `production`                 | `production`                       |

The `${{Postgres.DATABASE_URL}}` reference resolves per environment, so it needs
no edit when the environment is duplicated.

Staging keeps `NODE_ENV=production` deliberately. That keeps
`assertProductionConfig()` armed and `DEV_AUTH_BYPASS` inert on a host that is
reachable from the internet — staging should fail the same way production would.

`PORT` is not set: Railway injects it and `apps/api/src/index.ts` reads
`process.env.PORT ?? 8787`.

`WEB_ORIGIN` is required: it is both the CORS allowlist and the set of
authorized parties for Clerk token verification, so a token minted for another
application is rejected. Multiple origins are comma-separated.

The start command runs `prisma migrate deploy` before booting, so schema
changes apply on release.

Which branch an environment tracks is a **service setting, not a file** — the
`staging` environment's `runway` service has its source branch set to `develop`.
Read the current wiring with:

```bash
railway environment list
railway domain list --service runway --environment staging
railway variable list --service runway --environment staging
```

### Vercel (web)

One project, **Root Directory** `apps/web` — Vercel then installs from the pnpm
workspace root automatically.

The variables that differ by scope are the three that decide _which backend and
which Clerk instance a build talks to_:

| Variable                            | Production   | Preview (incl. `develop`) |
| ----------------------------------- | ------------ | ------------------------- |
| `NEXT_PUBLIC_API_URL`               | prod Railway | **staging Railway**       |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…`  | **`pk_test_…`**           |
| `CLERK_SECRET_KEY`                  | `sk_live_…`  | **`sk_test_…`**           |

The rest are the same in both scopes:

| Variable                                          | Value      |
| ------------------------------------------------- | ---------- |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/runway`  |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/runway`  |

Splitting `NEXT_PUBLIC_API_URL` by scope is the change that stops preview
deployments writing to the production database. Before it, one shared value
meant every preview's API calls landed on production.

### Settings that live only in a dashboard

None of these are expressible in `railway.json` or `vercel.json`, so they exist
nowhere in this repo. They are listed here so they are not tribal knowledge:

| Setting                                            | Where                                     | Value                          |
| -------------------------------------------------- | ----------------------------------------- | ------------------------------ |
| Root Directory                                     | Vercel → Settings → General               | `apps/web`                     |
| Production Branch                                  | Vercel → Settings → Git                   | `main`                         |
| Per-scope environment variables                    | Vercel → Settings → Environment Variables | see the table above            |
| Source branch for the `staging` service            | Railway → staging → runway → Settings     | `develop`                      |
| Default branch, auto-merge, delete-branch-on-merge | GitHub → Settings → General               | `develop`, on, on              |
| Required status checks (`verify`, `integration`)   | GitHub → Settings → Rules                 | rulesets on `main` + `develop` |

Vercel's **Production Branch** is independent of GitHub's default branch, so it
stays `main` even though GitHub now defaults to `develop`. Worth re-checking
after any change to the default branch.

If a `vercel.json` is ever added it must live at **`apps/web/vercel.json`** —
Root Directory is `apps/web`, so a repo-root file is silently ignored.

### Clerk instances

Every Clerk application has two instances, and this project uses both.

**Production** requires a custom domain: Clerk issues DNS records (including a
`CNAME` for its Frontend API) that must be added at your registrar, and
production keys only work on that domain. Create the production instance from
the Clerk dashboard, add its DNS records, then use its `pk_live_` / `sk_live_`
keys for Vercel's Production scope and Railway's `production` environment.

**Development** is why staging works at all. Dev instances accept arbitrary
origins, so its `pk_test_` / `sk_test_` keys work on `*.vercel.app` branch
aliases and on localhost — which the production instance cannot do, since it is
pinned to the DNS-verified domain. Those keys go to Vercel's Preview scope and
Railway's `staging` environment.

There is no Clerk CLI. Both key pairs are copied by hand from the dashboard
under API Keys, after switching instances with the selector at the top.

## Contributing

Conventions for commit messages, pull request descriptions and issues are in
[`AGENTS.md`](./AGENTS.md), which both humans and coding agents should read
before opening anything.

### Branching

`develop` is the default branch and the integration branch. `main` is
release-only.

```
feature branch ──PR──> develop ──release PR──> main
                          │                      │
                          ▼                      ▼
                       staging               production
```

Everything lands on `develop` first, where it deploys to the staging stack.
Shipping is a `develop → main` pull request. Nothing is pushed to `main`
directly — the release PR wants a merge commit, so `main` deliberately does
**not** require linear history.

Branch names are `<type>/<short-kebab-description>`, where the type matches the
Conventional Commits prefix of the work: `feat`, `fix`, `chore`, `test`, `ci`,
`docs`, `refactor`.

### Continuous integration

`.github/workflows/ci.yml` runs on push and pull request against `main` and
`develop`, in two jobs whose names are also the required status check contexts:

| Job           | Does                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| `verify`      | `typecheck` → `test` → build the API bundle → `format:check`                |
| `integration` | `postgres:16-alpine` service → `prisma migrate deploy` → `test:integration` |

Two jobs rather than four: `pnpm install` costs 40–60s and is paid per job,
while the whole suite runs in under five seconds. Every `verify` step carries
`if: ${{ !cancelled() }}` so one run reports every problem instead of one
problem per push. There are deliberately **no `paths:` filters** — a required
check that skips itself never reports, and the PR blocks forever.

Only the API bundle is built in CI; Vercel already builds `apps/web` per PR and
posts its own status.

Run `pnpm format` before committing. `format:check` is part of `verify`, so an
unformatted file fails the build.

## Roadmap

### Plaid (reserved)

Plaid is not integrated yet, but the space is reserved:

- `apps/api/src/routes/plaid.ts` — link-token / exchange / webhook endpoints
  returning 501
- `Account.plaidItemId/plaidAccountId/plaidAccessToken` and
  `Txn.plaidTransactionId` columns
- `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` in `.env.example`
- The Accounts modal shows a disabled "Connect a bank — coming soon" row

## Status and contact

Runway is in active development and is built and maintained by
[@HaseebKhanYT](https://github.com/HaseebKhanYT). The database schema, the API
surface and the deployment topology all still change without notice, and there
is no stability guarantee on any of them.

Questions, bugs and proposals go through
[GitHub issues](https://github.com/HaseebKhanYT/runway/issues). Please do not
report a suspected security problem in a public issue.

## License

No license is granted. All rights reserved.
