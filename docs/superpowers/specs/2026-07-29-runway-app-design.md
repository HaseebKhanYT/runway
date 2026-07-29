# Runway — v1 application design

Date: 2026-07-29
Status: approved (pending spec review)
Design source: `design-v1/` (canvas export). Implementation-ready catalog of every
screen, formula, token, and copy string: [2026-07-29-runway-design-catalog.md](./2026-07-29-runway-design-catalog.md).

## 1. What we're building

Runway is a paycheck-runway budgeting app. The core number is **safe to spend per
day**: `balance − bills due before payday − goal set-asides`, divided by days to
payday, clamped by a sustainability check (`min(perDay, sustainDay)`) so the pace
holds past payday. Everything else supports that number:

- **Dashboard**: hero number, runway timeline (horizontal on desktop, vertical
  spine on mobile) plotting bills + payday, category budget bars, recent activity.
- **Bills**: survival / subscriptions / debt groups, pay-from-source picker,
  drag-to-refile (desktop), swipe actions (mobile).
- **Goals**: wishes vs. necessities, per-paycheck set-asides, "plan a big
  expense" calculator with find-the-money levers.
- **Cash crunch**: when `safe < 0` the hero becomes a fix-it panel — pause
  goals, 0% friend loan, card advance, log income — then "Lock this plan".
- **Activity**: filter/search, expandable rows, recategorize, recently deleted.
- **Cards**: APR/limit/balance, promo rates, rewards pills, auto-synced card
  payment bills, payoff projections.
- **Accounts** modal (multi-account; pooled total drives the runway),
  **Payday confirm** (goals funded first, bills reset), 6-step **Onboarding**,
  **Settings**, auth screens.

New users go through onboarding after sign-up (approved decision). "Reset app
data" in Settings restores the design's demo dataset.

## 2. Stack (user-approved)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15, App Router, TypeScript |
| Backend | Hono (Node), TypeScript |
| Database | Postgres 16 (Docker) + Prisma |
| Auth | Clerk (free tier; 50k MRU) |
| Monorepo | pnpm workspaces + Turborepo |
| Client state | TanStack Query with optimistic updates |
| Styling | CSS Modules + design-token CSS custom properties |
| Tests | Vitest (shared domain math), Playwright smoke test |

## 3. Monorepo layout

```
apps/
  web/            Next.js app — UI, Clerk components, TanStack Query
  api/            Hono server — REST API, Clerk JWT verification, Prisma
packages/
  shared/         Pure domain logic + Zod schemas + formatting; no I/O
docker-compose.yml  Postgres 16
turbo.json, pnpm-workspace.yaml, tsconfig.base.json
```

### Naming — Google TypeScript Style Guide

- Files: `snake_case.ts` (e.g. `safe_per_day.ts`, `bill_row.tsx`). Next.js
  framework files (`page.tsx`, `layout.tsx`, `route.ts`, `middleware.ts`) keep
  their platform-required names.
- Types/interfaces/enums/classes/TSX components: `UpperCamelCase`.
- Variables/functions/params: `lowerCamelCase`. Global constants and enum
  values: `CONSTANT_CASE`.
- Single quotes, semicolons, `const` by default, `===`, no underscore
  prefixes/suffixes, acronyms as words (`loadHttpUrl`).

## 4. Domain package (`packages/shared`)

All money math is ported 1:1 from the design's logic class as pure functions —
the single source of truth used by both web (instant rendering) and api
(authoritative writes):

- `safe_per_day.ts` — DAYS/CYCLE, preBills, setAside, safe, perDay, sustainDay,
  effDay, squeezed, overCommitted (catalog §3.3).
- `goal_math.ts` — goalRemaining/Days/Checks/Per/PerMonth/Behind, bar split,
  spare projection (§3.5).
- `planner_math.ts` — necessity planner: plPer, plCap, gaps, financing,
  interest, covered (§3.6).
- `card_math.ts` — effective APR, amortization months/interest, min-payment
  guess, utilization, reward suggestion by card name (§3.7).
- `crunch_math.ts` — crunch shortfall, breaking bill, levers, covered (§3.8).
- `runway_layout.ts` — timeline node positioning (two-pass push-apart +
  compress, §3.4) and mobile spine gap spacing.
- `format.ts` — `fm()` (U+2212 minus, tabular money), `dayF()`, `d()`,
  `ordSuf()` (§3.9).
- `schemas.ts` — Zod schemas for all API payloads; inferred TS types.

Dates: the design stores day offsets from "today" (`off`). We store real dates
(`dueDate DateTime`, `dueDay Int` for monthly recurrence) and derive offsets at
read time in shared helpers, so data survives overnight. Transactions store
`postedAt DateTime`.

## 5. Data model (Prisma, Postgres)

All rows scoped by `userId` (Clerk user ID string). Money as `Decimal(12,2)`.

- **Profile** — name, email, cadence (`weekly|biweekly|semimonthly|monthly`),
  nextPayday (date), payAmount, pooled balance is derived (primary + accounts),
  primaryAccountName, primaryBalance, notifBills, notifWeekly, accent prefs,
  onboardedAt.
- **Account** (extra accounts) — name, type (`checking|cash|savings`), balance,
  logo. Reserved: `plaidItemId`, `plaidAccountId`, `plaidAccessToken` (nullable).
- **Bill** — name, amount, kind (`survival|subscription|debt`), dueDate,
  dueDay, cycle (`monthly|yearly`), paid, payFrom (`checking` | accountId |
  cardId), cardId (bill IS a card's payment), oneTime, personal, lender.
- **Category** — name, budget (0 = no limit), spent, color, locked
  (Uncategorized), sortOrder.
- **Transaction** — label, amount (signed), categoryName, postedAt, source
  label, cardId, deletedAt (soft delete = "recently deleted"). Reserved:
  `plaidTransactionId`.
- **Goal** — name, target, saved, perPaycheck, note, dueDate, necessity,
  paused (`null | '__crunch' | plan name`), financed, financedFrom, behind.
- **Card** — name, apr, limit, balance, dueDay, minPayment, payInFull,
  rewards (JSON `{rate, cat}[]`), promoRate, promoEndDate, balanceUpdatedAt.

## 6. API (`apps/api`, Hono)

Clerk JWT verified via middleware on every route; userId from the token. Zod
validation from `packages/shared`. CRUD plus **transactional flow endpoints**
(each one Prisma `$transaction`, mirroring the design's interlocked mutations):

- `GET /me/state` — full app state for the signed-in user (one fetch on load).
- CRUD: `/accounts`, `/bills`, `/categories`, `/goals`, `/cards`,
  `/transactions` (+ `POST /transactions/:id/restore`, `DELETE .../purge`,
  `POST /transactions/trash/clear`, `PATCH /transactions/:id/category`).
- Flows:
  - `POST /bills/:id/pay` `{source}` / `POST /bills/:id/unpay` — moves money
    (account debit, card charge, or card-balance reduction for card-payment
    bills), writes synthetic transaction, remembers source.
  - `POST /payday/confirm` `{amount}` — credit balance, fund goals in order,
    un-pause crunch-paused goals, drop one-time bills, reset paid flags,
    advance nextPayday by one cycle.
  - `POST /expenses` — expense (category spent += amt; card or account or
    checking debit) and income (balance += amt; optional goal set-aside).
  - `POST /goals/:id/set-aside` `{amount, source}`.
  - `POST /crunch/lock` `{pausedGoalIds, cardId?, advance?}`.
  - `POST /loans` — friend loan: balance credit + income txn + `Pay back {who}`
    debt bill.
  - `POST /planner/start` — create necessity/wish goal with pauses + card
    financing + synced financing bill.
  - `POST /onboarding/complete` — replaces bills/categories/cards, sets
    profile; `POST /reset-demo` — restore demo dataset.
- Card↔bill sync (`payInFull` bills pinned to live balance) runs inside every
  card/bill-touching transaction — one shared function, mirroring the design's
  `componentDidUpdate` choke point.
- **Plaid (reserved)**: `src/routes/plaid.ts` — `POST /plaid/link-token`,
  `POST /plaid/exchange`, `POST /plaid/webhook` all return `501 Not
  Implemented`; `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV` in `.env.example`.

## 7. Frontend (`apps/web`)

- App Router: `(app)/` group with `runway`, `bills`, `goals`, `activity`,
  `cards`, `settings` routes sharing the shell (sidebar ≥781px, pad nav
  620–780px, phone nav <620px, exactly per catalog §1.0). Clerk middleware
  protects the group; `/sign-in`, `/sign-up` use Clerk components themed with
  the appearance API to the design's warm auth look; onboarding overlay shown
  until `profile.onboardedAt`.
- State: one `GET /me/state` into TanStack Query; mutations call flow endpoints
  with optimistic cache updates; all derived numbers computed client-side via
  `packages/shared` selectors (never stored).
- Modals (add expense, category, accounts, pay-bill source, payday confirm,
  personal loan) as a modal-stack component honoring the design's z-order.
- Styling: `tokens.css` (every color/radius/shadow/type value from catalog §4)
  + CSS Modules per component; Instrument Sans via `next/font`; dark mode =
  the design's one-rule filter inversion; `fadeUp`/`pulse` keyframes.
- Interactions preserved: drag-to-refile bills, mobile swipe-to-reveal,
  runway-dot pay with fade-out, expandable activity rows, two-stage reset
  button, keyboard (Enter/Escape) handling.
- Accounts modal includes the disabled **"Connect a bank — coming soon"** row
  (Plaid reserved space in the UI).

## 8. Testing

- Vitest on `packages/shared` — the catalog gives exact expected values
  (e.g. seed data ⇒ safe/day $17, "−$142.00 → goals", crunch levers order).
- Playwright/Chrome smoke test after build: sign-up → onboarding → dashboard
  numbers correct → add expense → pay bill via source picker → payday confirm
  → visual pass against design screenshots.

## 9. Out of scope for v1

Real Plaid calls (space reserved only), push/email notifications (toggles
persist only), multi-currency, CSV import/export, the design's dead/unwired
values (catalog §5.4 — e.g. `heroMath`, `coachLine`, `Forgot your password?`
custom flow — Clerk handles password reset natively).

## 10. Decisions log

- Clerk / Postgres+Prisma / Hono / pnpm+Turborepo — user-selected 2026-07-29.
- Onboarding-first for new users; demo data only via Settings reset.
- Shared pure-domain package over client-heavy port (state drift) and
  server-computed viewmodels (latency, duplication).
- Real dates in DB instead of the design's day-offsets.
- Google TS Style: snake_case files; Next.js framework filenames exempt.
