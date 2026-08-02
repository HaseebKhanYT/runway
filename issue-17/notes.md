# Issue #17 — POST /planner/start finances the full target, ignoring the shortfall the UI showed

## Verdict

reproduced — the lever advertised "$2,153.00 on Card Y"; after "Lock this plan in" the card balance is $8,000.00, and the goal is born already fully funded.

## Steps executed

Real system date: 2026-08-02. Payday = 2026-08-16 (daysToPayday 14).

1. `POST /reset-demo`; deleted all demo bills/cards/goals via the API; `PATCH /profile {payAmount: 2000, primaryBalance: 2000}` (biweekly).
2. `POST /bills` Rent $4,000, survival, dueDay 22 (after payday — exists only to open a small planner gap so the card lever renders; surplus/spare still cover most of the target, as the issue's step 1 asks).
3. `POST /cards` Card Y: limit 10000, balance 0, apr 21.9 (no dueDay, payInFull false).
4. UI, Goals: "a necessity", "Hospital bill", target 8000, 12 months out (August 2027).
5. Selected the "Put the rest on Card Y · 21.9% APR" lever. Subtitle read "≈$236.00 interest over 12 mo"; gap line read "Covered ✓ · **$2,153.00 on Card Y**" (screenshot 01) — the client clamp: min(ceil(remainingGap × 24) = 2153, headroom 10000, target 8000).
6. Clicked "Lock this plan in".
7. Opened Cards (screenshot 02); captured `/me/state` before/after as JSON.

## Observed vs expected

Expected: the card is charged the figure the lever advertised — **$2,153** (the remaining gap the pause/spare levers could not cover, computed by `apps/web/src/lib/planner.ts:82-88` as min(ceil(89.68/paycheck-gap × 12 mo × 2 paychecks) = 2153, headroom 10000, target 8000)) — and the goal starts with saved = 2153 of 8000. Observed: `/me/state` after locking shows Card Y balance = **$8,000.00** (Cards page: "TOTAL DEBT $8,000.00", "balance $8,000.00 of $10,000.00", 80% of limit used) because `apps/api/src/services/start-plan.ts:23-24` mins only headroom and target, dropping the remainingGap term, and `plannerStartSchema` never carries the UI's figure. The interest subtitle the user agreed to (≈$236 on $2,153) is now wrong by ~3.7× on the real balance. Second consequence confirmed: the goal is created with `saved: 8000, financed: 8000` — "Fully funded — enjoy it", "$8,000.00 fronted by Card Y · $0.00 set aside from paychecks" (screenshot 03) — the savings plan is silently replaced by a maxed-out card, and SPARE TO SAVE collapsed to $0.00 because the resulting $667/mo financing bill eats the whole surplus.

## Screenshots

- 01-planner-advertises-2153-financed.png — lever selected, gap line "Covered ✓ · $2,153.00 on Card Y", interest "≈$236.00 over 12 mo".
- 02-card-charged-full-8000.png — Cards page after lock: Card Y balance $8,000.00 of $10,000.00, TOTAL DEBT $8,000.00, 80% of limit used.
- 03-goal-born-fully-funded.png — Goals page after lock: "Hospital bill $8,000.00 / $8,000.00 — Fully funded — enjoy it", "$8,000.00 fronted by Card Y".
