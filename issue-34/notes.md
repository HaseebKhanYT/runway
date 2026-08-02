# Issue #34 — Cards added during onboarding never reach the runway

## Verdict

`reproduced` — a card entered in onboarding is created with `dueDay: null`,
gets no payment bill, and its $3,000 debt has zero effect on safe-to-spend;
the same card gains a bill and moves the number the moment a due day exists.

## Steps executed

1. Reset demo (`POST /reset-demo`).
2. Re-entered onboarding the user-reachable way: Settings → "Run setup again"
   → **Run setup** → Get started.
3. Wizard inputs: balance $6,000 · pay $1,700 every 2 weeks · next payday
   2026-08-16 (today+14) · one bill (Rent $950 due the 5th) · **one card:
   "Sapphire", owe $3,000, limit $5,000, APR 24.99** (the step's own copy:
   "Add what you owe so Runway can plan payments and keep them off your
   safe-to-spend") · one category → "Show me my number".
4. Read `GET /me/state`: card `{dueDay: null, minPay: null}`; the only bill is
   Rent — **zero bills have a `cardId`** (`state-after-onboarding.json`).
   Matches complete-onboarding.ts:43-54 (no `dueDay` written, `syncCardBill`
   never called) and schemas.ts:155-162 (no field to even collect it).
5. Screenshotted Runway, Bills, Cards.
6. Contrast: `PATCH /cards/:id {dueDay: 10}` (the Cards-page Edit modal's
   endpoint) → `syncCardBill` created "Sapphire payment" $90
   (= `minPaymentGuess(3000)` = ceil(3000×0.03)), due 2026-08-10, off 8.
7. Reset demo.

## Observed vs expected

Expected: the $3,000 the user just typed in is reflected in safe-to-spend, or
the user is prompted for the missing due day. Observed: SAFE/DAY reads
**$90/day** computed as though the debt did not exist — sustainable surplus =
1700 − 950×14/30.44 ≈ $1,263 per cycle → floor(1263/14) = 90 — and the runway
timeline holds only Rent and Payday. With the due day added (step 6) the same
card produces a $90 bill inside the pre-payday window and SAFE/DAY drops to
**$87/day** (surplus 1700 − 1040×14/30.44 ≈ 1221.7 → floor(1221.7/14) = 87;
this cycle 6000−950−90 = 4960 → floor(4960/14) = 354 vs 360 before) — that
$3/day (and the $90 pre-payday obligation) is exactly what onboarding's
output silently drops. The only hint is on the Cards page — "No due date set
— Edit to add one · interest ≈ $62.00/mo at 24.99%" — which a fresh user has
no reason to visit; the runway itself shows nothing.

## Screenshots

- 01-onboarding-card-step-promise.png — card step with Sapphire $3,000/$5,000 · 24.99% listed and the "keep them off your safe-to-spend" promise.
- 02-runway-ignores-3000-card-debt.png — after onboarding: $90/day, timeline holds only Rent and Payday, no trace of the debt.
- 03-bills-no-card-payment-bill.png — Bills page with Rent only; no card payment bill exists.
- 04-cards-no-due-date-set.png — Cards page: Sapphire $3,000 of $5,000, "No due date set — Edit to add one".
- 05-contrast-with-dueday-bill-appears.png — after PATCH dueDay 10: "Sapphire payment $90.00 · Aug 10" node on the runway, SAFE/DAY $87.

API evidence: `state-after-onboarding.json` (dueDay null, no card-linked
bill), `state-after-dueday-contrast.json` (the bill syncCardBill creates once
a due day exists).
