# Runway App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Runway budgeting app (Next.js web + Hono API + Postgres) from the design in `docs/superpowers/specs/2026-07-29-runway-design-catalog.md` ("the catalog"), per the approved spec `docs/superpowers/specs/2026-07-29-runway-app-design.md` ("the spec").

**Architecture:** pnpm + Turborepo monorepo. `packages/shared` holds all pure domain math/formatting/Zod schemas (ported 1:1 from catalog §3). `apps/api` (Hono + Prisma + Clerk JWT) owns writes via transactional flow endpoints. `apps/web` (Next.js App Router + Clerk + TanStack Query) renders everything client-side from one `/me/state` fetch using shared selectors, with optimistic updates.

**Tech Stack:** TypeScript, Next.js 15+, Hono 4, Prisma 6 + Postgres 16 (Docker), Clerk, TanStack Query 5, Zod, CSS Modules, Vitest, Playwright (smoke).

## Global Constraints

- Naming: Google TS Style — **snake_case filenames** (`safe_per_day.ts`); Next.js framework files (`page.tsx`, `layout.tsx`, `route.ts`, `middleware.ts`) exempt. `UpperCamelCase` types/components, `lowerCamelCase` functions/vars, `CONSTANT_CASE` global constants. Single quotes, semicolons, `const` default, `===`, no underscore prefixes.
- Accent `#2E8C5A`; `showCents: true` (catalog §0 prop defaults — NOT the code fallbacks).
- Money display: `fm()` uses U+2212 minus (`−$`); `dayF()` uses ASCII hyphen, no cents (catalog §3.9). All numbers `font-variant-numeric: tabular-nums`.
- Font: Instrument Sans (variable, weights 400–700) via `next/font/google`.
- All catalog copy strings verbatim — do not paraphrase UI text.
- Do NOT implement catalog §5.4 dead values.
- Money in DB: Prisma `Decimal(12,2)`; in TS: `number` (parse Decimal at API boundary).
- API base: `http://localhost:8787`; web: `http://localhost:3000`; Postgres: `localhost:5433`.
- Commits: small, present-tense, explain why; NO Claude attribution trailers/footers.
- Every commit must pass `pnpm typecheck` and `pnpm test` at repo root.

## File Structure (target)

```
pnpm-workspace.yaml  turbo.json  tsconfig.base.json  docker-compose.yml
.env.example  package.json  .prettierrc.json  eslint.config.mjs
packages/shared/src/
  money.ts            fm, dayF, d, ordSuf, round2
  cycles.ts           cycleDays, daysUntil, Cadence type
  types.ts            AppState, Profile, Account, Bill, Category, Txn, Goal, Card
  schemas.ts          Zod schemas for every API payload
  safe_per_day.ts     computeRunway(state, today) -> RunwaySummary
  goal_math.ts        goalRemaining/Days/Checks/Per/PerMonth/Behind, barSplit, spare
  card_math.ts        effApr, payoffProjection, minPaymentGuess, suggestRewards, cardLine
  crunch_math.ts      computeCrunch(state, runway) -> CrunchSummary
  planner_math.ts     computePlan(input, state, runway) -> PlanSummary
  runway_layout.ts    layoutTimeline(bills, DAYS) -> nodes with pct/side; spineGaps
  view_model.ts       hero/sidebar/labels string builders (heroLabel, heroSub, perDaySub…)
  demo_data.ts        the catalog §3.2 seed, as a function of `today`
  index.ts            re-exports
packages/shared/test/ *.test.ts (Vitest, one per module)
apps/api/src/
  index.ts            Hono app, CORS, mount routes
  auth.ts             Clerk JWT middleware -> c.get('userId')
  db.ts               PrismaClient singleton
  serialize.ts        Prisma rows -> AppState JSON (Decimal->number, dates->ISO)
  state.ts            GET /me/state (+ ensureUser)
  card_bill_sync.ts   syncCardBill(tx, userId, cardId) — the single choke point
  routes/accounts.ts routes/bills.ts routes/categories.ts routes/goals.ts
  routes/cards.ts routes/transactions.ts routes/flows.ts routes/onboarding.ts
  routes/plaid.ts     501 stubs (reserved)
apps/api/prisma/schema.prisma
apps/api/test/ flows.test.ts (Vitest, against test DB)
apps/web/src/
  middleware.ts  app/layout.tsx  app/globals.css  app/tokens.css
  app/sign-in/[[...sign-in]]/page.tsx  app/sign-up/[[...sign-up]]/page.tsx
  app/(app)/layout.tsx        shell: sidebar/padnav/phonenav + header + modals host
  app/(app)/runway/page.tsx bills/page.tsx goals/page.tsx activity/page.tsx
  app/(app)/cards/page.tsx settings/page.tsx
  lib/api_client.ts   typed fetch wrapper w/ Clerk token
  lib/queries.ts      useAppState + mutation hooks w/ optimistic updates
  lib/use_media.ts    isMobile (<=780) / wideMobile (>=620)
  components/shell/   sidebar.tsx nav_pill.tsx page_header.tsx safe_day_card.tsx
  components/dashboard/ hero.tsx crunch_panel.tsx runway_horizontal.tsx
                        runway_vertical.tsx categories_panel.tsx activity_panel.tsx
  components/activity/  activity_row.tsx txn_expand.tsx trash_accordion.tsx
  components/bills/     bill_group.tsx bill_row.tsx bill_form.tsx
  components/goals/     spare_card.tsx goal_card.tsx planner_card.tsx
  components/cards/     card_tile.tsx card_form.tsx
  components/settings/  panels.tsx
  components/onboarding/onboarding.tsx (steps 0–5)
  components/modals/    modal.tsx add_expense.tsx category_modal.tsx accounts_modal.tsx
                        pay_source_modal.tsx payday_modal.tsx loan_modal.tsx
  components/ui/        toggle.tsx chip.tsx progress_bar.tsx seg_control.tsx
e2e/smoke.spec.ts (Playwright, run manually via MCP browser too)
```

---

### Task 1: Monorepo scaffold + Postgres

**Files:** Create `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `tsconfig.base.json`, `.prettierrc.json`, `docker-compose.yml`, `.env.example`, `packages/shared/package.json`, `packages/shared/tsconfig.json`, `apps/api/package.json`, `apps/web` (via create-next-app in Task 8).

**Interfaces produced:** workspace commands `pnpm typecheck`, `pnpm test`, `pnpm dev`; running Postgres at `localhost:5433`.

- [ ] Root `package.json`: private, `packageManager: pnpm`, scripts `dev: turbo dev`, `build: turbo build`, `test: turbo test`, `typecheck: turbo typecheck`; devDeps `turbo`, `typescript`, `prettier`.
- [ ] `pnpm-workspace.yaml`: `packages: ['apps/*', 'packages/*']`.
- [ ] `tsconfig.base.json`: `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `verbatimModuleSyntax: true`.
- [ ] `turbo.json`: tasks `build` (dependsOn `^build`), `dev` (persistent, no cache), `test`, `typecheck`.
- [ ] `docker-compose.yml`: `postgres:16-alpine`, port `5433:5432`, user/pass/db `runway`, volume `runway-pgdata`.
- [ ] `.env.example`: `DATABASE_URL=postgresql://runway:runway@localhost:5433/runway`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=`, `CLERK_SECRET_KEY=`, `NEXT_PUBLIC_API_URL=http://localhost:8787`, `# --- Plaid (reserved — not used in v1) ---`, `PLAID_CLIENT_ID=`, `PLAID_SECRET=`, `PLAID_ENV=sandbox`.
- [ ] `packages/shared`: package `@runway/shared`, exports `./src/index.ts`, scripts `test: vitest run`, `typecheck: tsc --noEmit`; devDeps vitest, typescript; deps zod.
- [ ] `docker compose up -d` and verify `pg_isready -h localhost -p 5433` → accepting connections.
- [ ] Commit: `chore: scaffold pnpm/turborepo monorepo with dockerized postgres`.

### Task 2: shared — money, cycles, types

**Files:** Create `packages/shared/src/{money,cycles,types,index}.ts`, `packages/shared/test/{money,cycles}.test.ts`.

**Interfaces produced:**
```ts
fm(n: number, showCents?: boolean): string   // fm(-950) === '−$950.00' (U+2212)
dayF(n: number): string                      // dayF(-4) === '-$4' (ASCII hyphen)
d(off: number, today: Date): string          // 'Jul 30'
ordSuf(n: number): string                    // 1→'st' 2→'nd' 3→'rd' 4→'th' 11→'th' 21→'st'
round2(n: number): number
type Cadence = 'weekly'|'biweekly'|'semimonthly'|'monthly';
cycleDays(c: Cadence): 7|14|15|30
daysUntil(dateIso: string, today: Date): number  // midnight-to-midnight rounded
// types.ts — plain interfaces matching spec §5 but with `off`-style derived
// fields computed at read time: Bill has dueDate: string (ISO), plus derived
// helper billOff(bill, today). AppState mirrors catalog §3.1 with accounts[],
// deletedTxns[] and profile {name,email,cadence,nextPay,payAmount,primaryName,
// primaryBalance,notifBills,notifWeekly,onboarded}.
// Pooled balance = profile.primaryBalance + Σ accounts.balance → export
// pooledBalance(state): number
```

- [ ] Write failing tests: `fm(1234.5)` → `'$1,234.50'`; `fm(-950)` → `'−$950.00'`; `fm(1234.5, false)` → `'$1,235'`; `dayF(17)` → `'$17'`; `dayF(-4)` → `'-$4'`; `ordSuf` for 1,2,3,4,11,12,13,21,22,23; `cycleDays` all four; `daysUntil('2026-07-30', new Date('2026-07-16T12:00:00'))` → 14.
- [ ] `pnpm --filter @runway/shared test` → FAIL (modules missing).
- [ ] Implement per catalog §3.9 exactly. `daysUntil`: `Math.round((Date.parse(iso + 'T00:00:00') - todayMidnight) / 86400000)`.
- [ ] Tests PASS. Commit: `feat(shared): money formatting, pay cycles, domain types`.

### Task 3: shared — goal_math + safe_per_day

**Files:** Create `packages/shared/src/{goal_math,safe_per_day}.ts`, tests.

**Interfaces produced:**
```ts
goalRemaining(g: Goal): number
goalDays(g: Goal, today: Date): number | null
goalChecks(g: Goal, cadence: Cadence, today: Date): number | null
goalPer(g: Goal, cadence: Cadence, today: Date): number
goalPerMonth(g: Goal, cadence: Cadence, today: Date): number
goalBehind(g: Goal, cadence: Cadence, today: Date): boolean
goalBarSplit(g: Goal): {finPct: number; payPct: number}
spareMonthly(cycleSurplus: number, cadence: Cadence): number  // nearest $10
interface RunwaySummary { CYCLE: number; DAYS: number; preBillsSum: number;
  setAside: number; safe: number; perDay: number; sustainDay: number;
  effDay: number; squeezed: boolean; overCommitted: boolean; cycleSurplus: number; }
computeRunway(state: AppState, today: Date): RunwaySummary
```

- [ ] Write failing tests from catalog §3.3/§3.5 formulas. Hand-computed cases:
  - No-due goal: `{target: 1000, saved: 400, per: 40}` → `goalPer` 40; `goalRemaining` 600.
  - Due goal: target 2400, saved 860, due 280 days out, biweekly → checks `floor(280/14)=20` → per `ceil(1540/20)=77`.
  - `computeRunway`: balance 1000, one unpaid bill $100 `off` 3, one paid bill $500 `off` 5, goal per 40 (no due), pay 1700, cadence biweekly, nextPay 10 days out → DAYS 10; preBillsSum 100; setAside 40; safe 860; perDay `floor(86)`=86; billsMonthly 600 (both bills recur); billsPerCycle `600*14/30.44`≈275.95; cycleSurplus ≈1384.05; sustainDay `floor(1384.05/14)`=98; effDay 86; squeezed false.
  - Negative: balance 50, bill 100 off 2, DAYS 14 → safe −50 → perDay `−ceil(50/14)`=−4.
  - Yearly sub $120/yr → billsMonthly contribution 10. oneTime/personal bills excluded from sustainability.
- [ ] FAIL → implement exactly per catalog → PASS.
- [ ] Commit: `feat(shared): goal math and safe-per-day core formula`.

### Task 4: shared — card, crunch, planner, layout, view_model, demo_data, schemas

**Files:** Create remaining shared modules + tests for each.

**Interfaces produced:**
```ts
effApr(c: Card, today: Date): number
payoffProjection(c: Card, monthlyPayment: number): {months: number; interest: number} | null
minPaymentGuess(balance: number): number      // max(25, ceil(b*0.03))
suggestRewards(name: string): {rate: string; cat: string}[]
cardLine(c: Card, bill: Bill|undefined, today: Date): {text: string; color: string}
interface CrunchSummary { on: boolean; short: number; billLine: string;
  goalLevers: …; cardLevers: …; freed(sel): number; /* per catalog §3.8 */ }
computeCrunch(state, runway, selection): CrunchSummary
computePlan(input: {name; target; months; kind; pausedIds; cardId; earn},
            state, runway, today): PlanSummary   // catalog §3.6 incl. exact strings
layoutTimeline(bills: Bill[], DAYS: number, today: Date):
  {nodes: {id; pct; side: 'above'|'below'; payday?: true}[]}   // catalog §3.4
spineRows(bills, DAYS, today): {rows: …, marginTop: number}[]  // clamp(gap*7,16,82)
buildViewModel(state, today): {heroLabel; heroNumber; heroSub; heroColor;
  perDayF; perDaySub; perDayColor; pageTitle(view); acctChipTag; daysToPay; …}
demoData(today: Date): AppState                 // catalog §3.2 verbatim
// schemas.ts: zod schemas — billCreate, billUpdate, categoryUpsert, goalCreate,
// goalUpdate, cardUpsert, accountUpsert, expenseCreate {kind:'expense'|'income'…},
// payBill {source}, paydayConfirm {amount}, crunchLock {pausedGoalIds, cardId?,
// advance?}, loanCreate {who, amount, dueDate}, plannerStart, onboardingComplete,
// txnPatch. Export inferred types.
```

- [ ] Tests (write → FAIL → implement → PASS), key cases:
  - `layoutTimeline`: bills at off 3,7,8,9,11,13 + DAYS 14 → all pct within 9–91, min 7 apart, same-side min 13 apart, payday last + below; monotone order preserved.
  - `payoffProjection`: balance 1240, APR 17.9, payment 160 → months 9 (formula `ceil(-ln(1-r*B/P)/ln(1+r))`, r=0.0149167), interest = `max(0, round(160*9−1240))`.
  - `suggestRewards('Amex Gold')` → `[{rate:'4x',cat:'restaurants'},{rate:'4x',cat:'groceries'},{rate:'3x',cat:'flights'}]`.
  - `demoData` snapshot: 7 bills, 6 cats, 14 txns, 2 goals, 2 cards, balance 6000, pay 1700.
  - crunch: balance 500, bills 950@3 → safe<0, billLine `Not enough for Rent ($950.00, due {d})`, cheapest-first lever ordering.
  - `buildViewModel` hero strings — all five variants (catalog §1.1A) selected by state.
- [ ] Commit per module (5 commits): `feat(shared): card math`, `…crunch math`, `…planner math`, `…timeline layout + view model`, `…demo data + zod schemas`.

### Task 5: api — Prisma schema, Clerk auth, GET /me/state

**Files:** Create `apps/api/package.json` (`@runway/api`; deps hono @hono/node-server @hono/zod-validator @clerk/backend @prisma/client zod @runway/shared; devDeps prisma tsx vitest), `apps/api/prisma/schema.prisma`, `src/{index,auth,db,serialize,state}.ts`.

**Prisma schema** (spec §5; all models have `id String @id @default(cuid())`, `userId String` + `@@index([userId])`):
```prisma
model Profile { userId String @id; name String @default(""); email String @default("");
  cadence String @default("biweekly"); nextPay DateTime?; payAmount Decimal @default(1700) @db.Decimal(12,2);
  primaryName String @default("Main checking"); primaryBalance Decimal @default(0) @db.Decimal(12,2);
  primaryLogo String?; notifBills Boolean @default(true); notifWeekly Boolean @default(false);
  onboardedAt DateTime?; }
model Account { …name; type String; balance Decimal @db.Decimal(12,2); logo String?;
  plaidItemId String?; plaidAccountId String?; plaidAccessToken String?; }
model Bill { …name; amount Decimal @db.Decimal(12,2); kind String; dueDate DateTime;
  cycle String @default("monthly"); paid Boolean @default(false); payFrom String?;
  cardId String?; oneTime Boolean @default(false); personal Boolean @default(false); lender String?; }
model Category { …name; budget Decimal @default(0) @db.Decimal(12,2);
  spent Decimal @default(0) @db.Decimal(12,2); color String; locked Boolean @default(false); sortOrder Int @default(0); }
model Txn { …label; amount Decimal @db.Decimal(12,2); cat String; postedAt DateTime;
  src String?; cardId String?; deletedAt DateTime?; plaidTransactionId String?; billId String?; }
model Goal { …name; target Decimal…; saved Decimal…; per Decimal…; note String @default("");
  due DateTime?; necessity Boolean @default(false); paused String?; behind Boolean @default(false);
  financed Decimal @default(0)…; financedFrom String?; }
model Card { …name; apr Decimal @db.Decimal(5,2); limit Decimal…; balance Decimal…;
  dueDay Int?; minPay Decimal?…; payInFull Boolean @default(false); rewards Json @default("[]");
  promoRate Decimal?…; promoEnd DateTime?; balanceUpdatedAt DateTime @default(now()); }
```

**Interfaces produced:** `authMiddleware` sets `c.get('userId')`; `GET /me/state` → `AppState` JSON (serialize: Decimal→number, dueDate→`off` via `daysUntil`, txn postedAt→`off`, plus raw ISO dates); `ensureUser(userId)` creates Profile on first hit (empty, `onboardedAt: null`).

- [ ] Write schema; `pnpm --filter @runway/api exec prisma migrate dev --name init` → migration applies.
- [ ] `auth.ts`: verify `Authorization: Bearer <token>` with `@clerk/backend` `verifyToken` (`CLERK_SECRET_KEY`); 401 without. In dev, allow header `x-dev-user` override ONLY when `process.env.DEV_AUTH_BYPASS === '1'` (for API tests).
- [ ] Failing test (`apps/api/test/state.test.ts`, DEV_AUTH_BYPASS): GET /me/state as fresh user → 200, `profile.onboarded === false`, empty collections. Run → FAIL → implement `serialize.ts` + `state.ts` → PASS.
- [ ] CORS: allow `http://localhost:3000`, headers Authorization/Content-Type.
- [ ] Commit: `feat(api): prisma schema, clerk auth middleware, /me/state`.

### Task 6: api — CRUD routes

**Files:** Create `src/routes/{accounts,bills,categories,goals,cards,transactions}.ts`; test `apps/api/test/crud.test.ts`.

**Interfaces produced (all under auth, all zod-validated, all return fresh `AppState`):**
```
POST/PATCH/DELETE /accounts(/:id)        PATCH /profile (name,email,cadence,nextPay,
POST/PATCH/DELETE /bills(/:id)             payAmount, primaryBalance, primaryName,
POST/PATCH/DELETE /categories(/:id)        notifBills, notifWeekly)
POST/PATCH/DELETE /goals(/:id)
POST/PATCH/DELETE /cards(/:id)
DELETE /transactions/:id                 → soft delete (deletedAt=now, "record only")
POST /transactions/:id/restore           DELETE /transactions/:id/purge
POST /transactions/trash/clear           PATCH /transactions/:id/category
```
Rules from catalog: category delete re-points txns to `Uncategorized` and is blocked for `locked`; goal delete returns `saved` to primaryBalance + logs `Returned from {goal}` txn; card create/update runs `syncCardBill` (Task 7 — stub as no-op here, wire in Task 7); card delete removes its payment bill; account delete folds balance handling: pooled total drops (no compensation); bill PATCH `kind` powers drag-refile.
- [ ] Failing tests: create bill → appears in state with computed `off`; goal delete refunds; category delete blocked when locked; txn soft-delete → in `deletedTxns`, restore → back. FAIL → implement → PASS.
- [ ] Commit: `feat(api): crud routes for all entities`.

### Task 7: api — transactional flows + card↔bill sync

**Files:** Create `src/card_bill_sync.ts`, `src/routes/flows.ts`, `src/routes/onboarding.ts`; test `apps/api/test/flows.test.ts`.

**Interfaces produced (each one Prisma `$transaction`; each returns fresh AppState):**
```
POST /bills/:id/pay {source}   POST /bills/:id/unpay
POST /payday/confirm {amount}  POST /expenses {kind, amount, category?, source?,
POST /goals/:id/set-aside        goalId?, note?}
  {amount, source?}            POST /loans {who, amount, dueDate}
POST /crunch/lock {pausedGoalIds, cardId?, advance?}
POST /planner/start {name, target, months, kind, pausedIds, cardId?, earn?}
POST /onboarding/complete {balance, pay, cadence, nextPay, bills[], cards[], cats[]}
POST /reset-demo
syncCardBill(tx: PrismaTx, userId: string, cardId: string): Promise<void>
```
Implement exactly per catalog §2.2 (pay/unpay money movement incl. card-payment bills reducing card balance; payday: goals funded in order before anything, `'__crunch'` un-pause, one-time bill removal, paid reset, **advance nextPay by one cycle**; expenses: card source leaves cash untouched + `balanceUpdatedAt` now; income → optional immediate goal set-aside of `min(amt, remaining)`; loan creates `Pay back {who}` oneTime personal debt bill; crunch lock pauses + optional card advance credited to cash with `Advance from {card}` income txn; planner start per catalog §2.2; onboarding replaces bills/cats/cards, zeroes goals+txns, stamps `onboardedAt`; reset-demo loads `demoData(today)`).
`syncCardBill` per catalog: bill named `{card} payment`, kind debt, `cardId`, dueDate from `dueDay` (next occurrence), amount = payInFull ? balance : minPay ?? existing ?? `minPaymentGuess(balance)`; delete bill when no dueDay; called from every card/bill/expense flow that touches a card.
- [ ] Failing tests (the heart of the API — be thorough): pay bill from checking debits primaryBalance + creates txn `bill-{id}`-style linked via `billId`; unpay reverses both; pay card-payment bill reduces card balance; expense on card leaves cash; payday funds goals in order and clamps at `max(0, balance)`; payday advances nextPay one cycle; crunch lock pauses goals + advance txn; loan creates debt bill; onboarding wipes correctly; reset-demo matches demoData counts; payInFull card keeps bill pinned to balance after an expense on that card.
- [ ] FAIL → implement → PASS. Commit: `feat(api): transactional money flows and card-bill sync`.

### Task 8: api — Plaid stubs; web — Next.js scaffold + Clerk + tokens

**Files:** Create `src/routes/plaid.ts`; scaffold `apps/web` (create-next-app, TS, App Router, no Tailwind, src dir); `app/tokens.css`, `app/globals.css`, `middleware.ts`, `lib/api_client.ts`, sign-in/up pages.

**Interfaces produced:** `/plaid/link-token`, `/plaid/exchange`, `/plaid/webhook` → `501 {error: 'Plaid integration reserved — not implemented'}`; web boots with Clerk (keyless dev mode if no keys), tokens.css defines every catalog §4.1/§4.3 custom property (`--bg`, `--surface`, `--ink`, … `--accent: #2E8C5A`), fadeUp/pulse keyframes, dark-mode filter rule (catalog §4.5), Instrument Sans variable font on `<body>`;
```ts
apiFetch<T>(path: string, init?: RequestInit & {json?: unknown}): Promise<T> // adds Clerk Bearer token, NEXT_PUBLIC_API_URL
```
- [ ] Plaid stub + test (`501`). Commit: `feat(api): reserved plaid endpoint stubs`.
- [ ] Scaffold web; strip boilerplate; `middleware.ts` = `clerkMiddleware` protecting `/(app)` routes, public `/sign-in`, `/sign-up`; sign-in/up pages: centered on `--bg`, Runway brand mark (CSS circle+bar per catalog §1.8) + `<SignIn/>`/`<SignUp/>` with appearance `{variables: {colorPrimary: '#2E8C5A', colorBackground: '#fffcf6', colorText: '#29221a', borderRadius: '11px', fontFamily: 'inherit'}}`, taglines + footnote copy verbatim (catalog §1.8).
- [ ] `pnpm --filter web dev` boots; `/` redirects unauthenticated → sign-in. Commit: `feat(web): next.js scaffold with clerk auth and design tokens`.

### Task 9: web — state layer + app shell

**Files:** Create `lib/{queries,use_media}.ts`, `app/(app)/layout.tsx`, `components/shell/*`, `components/ui/*`, the six route `page.tsx` files (placeholder content), redirect `/` → `/runway`.

**Interfaces produced:**
```ts
useAppState(): {state: AppState | undefined; …}          // ['state'] queryKey
useFlow<TIn>(path): mutation posting json, onSuccess: setQueryData(['state'], resp)
  // every API response IS the fresh AppState → cache replace, no invalidation dance
useOptimistic helpers: patchState(fn) for instant UI, rollback on error
useMedia(): {isMobile: boolean; wideMobile: boolean}     // matchMedia 780/620
<Shell> renders: sidebar (≥781) per catalog §1.0 (brand, 6 nav items via
  usePathname, Bills unpaid badge, + Add expense btn, SAFE/DAY card),
  padNav/phoneNav glass pills + FAB (catalog shadows/glass verbatim),
  page header (title map, date subtitle, balance chip → accounts modal,
  payday chip), modal host (React context: openModal('addExpense'|…, props)).
```
- [ ] Onboarding gate: `(app)/layout.tsx` client wrapper — if `state.profile.onboarded === false` render `<Onboarding/>` overlay (Task 15) — until then a "Loading…" stub; nav works; SAFE/DAY shows `buildViewModel` outputs from demo/reset state.
- [ ] Manual check: `pnpm dev`, sign in (keyless), see shell on all six routes at three breakpoints.
- [ ] Commit: `feat(web): app shell, responsive nav, query state layer`.

### Task 10: web — Dashboard (hero, runways, categories, activity panels)

**Files:** Create `components/dashboard/*`, `components/activity/{activity_row,txn_expand}.tsx`, `components/ui/progress_bar.tsx`; wire `runway/page.tsx`.

Implement catalog §1.1 A–D verbatim: hero (5 sub variants via `buildViewModel`), horizontal timeline from `layoutTimeline` (Today node, alternating bill dots w/ hover scale + click→pay-source modal + 1300ms fade on paid, pulsing payday node → payday modal, labels `Payday · Jul 30 / +$1,700.00 / −$125.00 → goals` style), vertical spine from `spineRows` (mobile), categories panel (Edit/Done manage mode, over-budget colors, + Add category → category modal), recent activity (7 rows, shared `activity_row` with expand panel per catalog §1.13, recategorize only for spend txns, View all → /activity).
- [ ] Verify against demo data in browser (values from shared tests — e.g. hero `$69/day` w/ squeezed sub for seeded state at DAYS=14).
- [ ] Commit: `feat(web): dashboard with runway timeline, categories, activity`.

### Task 11: web — modals (add expense, category, accounts, pay source, payday, loan)

**Files:** Create `components/modals/*`; `components/ui/{chip,seg_control}.tsx`.

Catalog §1.10–§1.15 verbatim: shared `<Modal z={50|55}>` scrim/sheet/fadeUp/stopPropagation/Escape; add-expense (expense|income seg, category chips + `+ New` w/ return, PAYING FROM incl. cards, consequence-first save labels — all 5 variants), category modal (10 swatches, locked rules, delete), accounts modal (total banner, rows w/ bank logos from `/public/banks/*` — copy the two PNGs from design assets —, add/edit form, **disabled "Connect a bank — coming soon" row**), pay-source modal (after-balances, card `charges the card` line, over-limit/short states, remember source), payday modal (3 options + custom amount edit state + what-happens footer), loan modal (WHO/HOW MUCH/PAY BACK BY, 3 note states, dynamic CTA).
- [ ] Each wired to its flow mutation with optimistic update; verify add-expense over-budget label math in browser.
- [ ] Commit: `feat(web): money modals wired to flow endpoints`.

### Task 12: web — Bills view

**Files:** Create `components/bills/*`; wire `bills/page.tsx`.

Catalog §1.3 verbatim: progress card, three groups w/ sums, grid rows (checkbox→pay-source, tags, meta states, desktop ✕), inline add/edit form (subscription presets, due-day, monthly/yearly, PAY FROM chips when extra accounts, Enter/Escape), desktop drag-to-refile (HTML5 DnD → `PATCH /bills/:id {kind}`), mobile swipe-left reveal (touch handlers, 140/70px, latch at half, Edit/Delete actions).
- [ ] Commit: `feat(web): bills checklist with drag refile and swipe actions`.

### Task 13: web — Goals + planner, Cash crunch

**Files:** Create `components/goals/*`, `components/dashboard/crunch_panel.tsx`; wire `goals/page.tsx`.

Catalog §1.4 + §1.2 verbatim: spare card (projection strings), goal cards (two-segment bar + legend, per-month label, remaining line, 6 status variants, set-aside inline form w/ FROM chips, edit form incl. the "within $1 keeps due date" rule — implement client-side pre-PATCH), planner card (wish|necessity, month stepper 1–600, `plPerLine` exact strings from `computePlan`, levers cheapest-first, gap line, CTA states → `/planner/start`), crunch panel replacing hero when `safe < 0` (lever stacking UI state → `/crunch/lock`, Borrow → loan modal prefilled `ceil(crunchRem)`, Log money in → add-expense income mode).
- [ ] Commit: `feat(web): goals, big-expense planner, cash crunch levers`.

### Task 14: web — Activity + Cards views

**Files:** Create `components/activity/trash_accordion.tsx`, `components/cards/*`; wire `activity/page.tsx`, `cards/page.tsx`.

Catalog §1.5 + §1.6 verbatim: stats trio, filter chips + search (client-side over state), day-group cards w/ shared rows, pagination 12/+15, empty state, trash accordion (restore/purge/clear); cards summary strip, tiles (APR/promo/due tags, reward pills w/ `catPill` palette, utilization bar, 5 status lines from `cardLine`, log-payment inline flow → `/expenses`-style card payment: implement as `PATCH /cards/:id` balance decrement + txn via dedicated flow `POST /cards/:id/log-payment {amount, source}` — add this endpoint in this task with test), add/edit form (pay-in-full toggle w/ disabled payment field, rewards editor, promo toggle, helper copy), stale stamp.
- [ ] Commit: `feat(web): activity feed with trash, credit cards management`.

### Task 15: web — Settings + Onboarding

**Files:** Create `components/settings/panels.tsx`, `components/onboarding/onboarding.tsx`; wire `settings/page.tsx`.

Catalog §1.7 + §1.9 verbatim: masonry columns; profile (initials avatar, name/email → PATCH /profile, **Sign out** via Clerk `signOut()`), money panel (balance=primaryBalance, paycheck, cadence 3-up, next payday date input), cards summary + Manage →, notification toggles, run-setup-again (opens onboarding w/ escape hatch), two-stage reset → `/reset-demo`. Onboarding steps 0–5 with exact headings/hints/presets/CTA-count labels, Enter/back behavior → `/onboarding/complete`.
- [ ] Commit: `feat(web): settings and six-step onboarding`.

### Task 16: Smoke test (Chrome) + fixes + PR

- [ ] Seed a signed-in session (Clerk keyless/test user), run full pass in Chrome via Playwright MCP: sign-up → onboarding (add bill $950 due 15th, Netflix preset, one card, default cats) → dashboard hero/number sanity vs `computeRunway` → add expense over budget → pay bill via source picker (timeline dot fades) → payday confirm (goals funded, bills reset) → force crunch (spend below zero) → lock plan w/ pause → activity recategorize + delete/restore → cards log payment → settings reset-demo → screenshot side-by-sides vs `design-v1/screenshots/`.
- [ ] Fix everything found; keep commits small (`fix(web): …`).
- [ ] `e2e/smoke.spec.ts` encoding the happy path (sign-in via Clerk test token or DEV_AUTH_BYPASS + direct state seeding; document in file header).
- [ ] `README.md`: setup (docker compose, env, pnpm dev), architecture pointer to spec.
- [ ] Push `-u origin feat/runway-app`; `gh pr create` (summary + test plan; no attribution footer). Hand URL to user. Do NOT merge.

## Self-Review Notes

- Spec coverage: §3 layout→T1, §4 shared→T2–4, §5 schema→T5, §6 API→T5–8 (+`/cards/:id/log-payment` added T14), §7 web→T8–15, §8 testing→per-task TDD + T16, Plaid→T8, onboarding-first→T9/T15. Gap check: card "Log payment" needed a dedicated endpoint — added T14. `PATCH /profile` covers Settings money panel — in T6.
- Type consistency: `AppState` produced by `serialize.ts` (T5) must equal `types.ts` (T2) — single import from `@runway/shared` enforced. Flow endpoints all return `AppState` (T7) which `useFlow` (T9) relies on.
- No placeholders: UI tasks cite exact catalog sections (committed doc) for pixel specs; formulas/tests are explicit above.
