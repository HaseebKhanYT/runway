# Issue #16 — Financing a plan on a card counts the same debt twice on the runway

## Verdict

reproduced — locking one $8,000 financed plan subtracts $8,667 from safe-to-spend (a $667 "financing" bill AND the full $8,000 pay-in-full card bill), landing on exactly the −$6,667 the issue predicts.

## Steps executed

Real system date: 2026-08-02. Payday (demo `nextPay`) = 2026-08-16, so daysToPayday = 14.

1. `POST /reset-demo`, then stripped to a minimal state via the app's own API: deleted all demo bills/cards/goals, `PATCH /profile {payAmount: 2000, primaryBalance: 2000}` (cadence already `biweekly`).
2. `POST /bills` Rent $4,000, survival, dueDay 22 (due 2026-08-22, i.e. AFTER payday — it never enters `billsDueBeforePayday`; it only exists to pull `cycleSurplus` low enough that the planner's "FIND THE MONEY" levers appear at all; with the issue's literal preconditions and no other bills, `initialGap` is negative and the card lever never renders).
3. `POST /cards` Card X: limit 10000, balance 0, apr 24.99, dueDay 11, payInFull true. (Sync created a $0 "Card X payment" bill due Aug 11.)
4. UI, Goals page: "a necessity", name "Hospital bill", target 8000, stepped the month picker 12× to August 2027.
5. Selected the "Put the rest on Card X · 24.99% APR" lever. UI showed "Covered ✓ · **$2,153.00 on Card X**" (screenshot 01).
6. Clicked "Lock this plan in".
7. Opened Runway (screenshot 02) and Bills (screenshot 03); pulled `/me/state` before and after (`state-before-lock.json`, `state-after-lock.json`).

## Observed vs expected

Observed: after locking, `/me/state` shows Card X balance = $8,000 AND two debt bills both due before payday: "Card X payment" $8,000 (due Aug 11, `cardId` set, pinned to the full balance because `payInFull`) and "Hospital bill financing" $667 (due Aug 12, `cardId: null`, `oneTime: false`). The runway subtracts both: safe = 2000 − (8000 + 667) − 0 = **−6,667**; the hero is replaced by the crunch panel reading "**$6,667.00 short**" and SAFE/DAY = −$477 (= −ceil(6667/14)). One $8,000 debt costs the runway $8,667 — more than the principal — the instant after the planner said "Covered ✓". Expected: a plan financed over 12 months should put roughly one installment on this cycle: ceil(8000/12) = $667, so safe = 2000 − 667 = **$1,333** (the debt counted once, as an installment). The set-aside term is 0 in both worlds because the goal is created with saved = financed = 8000 = target, so it is not an active goal.
Also confirmed the issue's tail claim: the financing bill is stored `oneTime: false`, `cycle: monthly` (see `state-after-lock.json`), so it drags `billsMonthly` (Bills page shows DEBT $8,667.00/month) every future cycle.

Source: `apps/api/src/services/start-plan.ts:27-43` (three writes for one debt), `apps/api/src/services/card-bill-sync.ts:22-29` (pay-in-full pins bill to full balance), `packages/shared/src/runway.ts:47-56` (both bills summed).

## Screenshots

- 01-planner-card-lever-covered.png — planner with the Card X lever selected: "Covered ✓ · $2,153.00 on Card X", CTA "Lock this plan in".
- 02-runway-cash-crunch.png — runway immediately after locking: "CASH CRUNCH · $6,667.00 short", timeline showing Card X payment $8,000 (Aug 11) AND Hospital bill financing $667 (Aug 12) before Payday Aug 16; balance $2,000.
- 03-bills-debt-double-count.png — Bills page DEBT group listing both "Card X payment $8,000.00" and "Hospital bill financing $667.00" for the same $8,000 principal ($8,667.00/month of "debt").
