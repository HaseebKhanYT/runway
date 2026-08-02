# Issue #19 — Bills never advance their due date, so paid bills reappear and overdue bills are subtracted forever

## Verdict

reproduced — after payday the card-settled $8,000 bill is back, unpaid, with its dueDate byte-identical (2026-08-07), while the same $8,000 sits on Card W; a psql-backdated due date 25 days in the past is still subtracted in full.

## Steps executed

Real system date: 2026-08-02. Payday = 2026-08-16 pre-confirm.

1. `POST /reset-demo`; deleted all demo bills/cards/goals via the API; `PATCH /profile {primaryBalance: 6000}` (kept biweekly $1,700 demo profile).
2. `POST /bills` "Hospital bill" $8,000, kind `debt`, dueDay 7 (→ due 2026-08-07). Note `billCreateSchema` has no `oneTime` field — the row is stored `oneTime: false`.
3. `POST /cards` Card W: limit 10000, balance 0, apr 22, dueDay 11 (sync created a $25 "Card W payment" bill).
4. UI, Bills: paid "Hospital bill" choosing **Card W** in the pay-source modal ("charges the card · $8,000.00 owed") — screenshot 01. After: bill `paid: true`, Card W balance = 8000, checking untouched at $6,000 (screenshot 02, state-after-card-payment.json).
5. UI, Runway: clicked the pulsing payday marker → payday modal → "Yes — $1,700.00 landed" (`POST /payday/confirm`).
6. Opened Bills (screenshot 03) and Runway (screenshot 04); state-after-payday.json.
7. psql: `UPDATE "Bill" SET "dueDate"='2026-07-08'` for this user's Hospital bill only (25 days in the past); reloaded (screenshot 05, state-backdated.json).

## Observed vs expected

Expected: an expense settled by charging it to a card is card debt and nothing else — it must not return as an unpaid bill; and a recurring bill's dueDate should roll forward one cycle at payday. Observed: payday (`apps/api/src/services/payday.ts:82-83`) deleted nothing (the bill is `oneTime: false` by construction) and reset `paid` to false, leaving "Hospital bill $8,000 due Aug 7" unpaid again with `dueDate` unchanged at 2026-08-07 — while Card W still carries the same $8,000 (one expense, two records, both counted). Runway after payday: balance = 6000 + 1700 = 7700, preBills = 8000 (resurrected bill) + 25 (card min) = 8025, safe = 7700 − 8025 = **−325** → crunch panel "**$325.00 short** — Not enough for Hospital bill ($8,000.00, due Aug 7)". Expected safe with the bill correctly settled: 7700 − 25 = **+7675**. After backdating the due date to 2026-07-08 the bill reports `off: -25` and is STILL fully subtracted (crunch unchanged at $325.00 short, screenshot 05) because the pre-payday filter `b.off < daysToPayday` (`packages/shared/src/runway.ts:47`) has no lower bound — a bill a month overdue is subtracted every cycle forever.

## Screenshots

- 01-pay-8000-from-card-modal.png — pay-source modal with Card W selected: "charges the card · $8,000.00 owed".
- 02-bill-paid-before-payday.png — after paying from the card: Hospital bill struck through "paid ✓", checking balance still $6,000.00.
- 03-after-payday-bill-reappears-unpaid.png — after confirming payday: Hospital bill back, unpaid, "due Aug 7" (same date), $8,025.00 left of $8,025.00 this month.
- 04-after-payday-runway-crunch.png — crunch panel "$325.00 short — Not enough for Hospital bill ($8,000.00, due Aug 7)" while Card W also owes the $8,000 (see state-after-payday.json).
- 05-backdated-overdue-still-subtracted.png — dueDate backdated to Jul 8 (off −25): bill shows "due Jul 8", still unpaid, SAFE/DAY still −$143 / $325.00 short — the overdue bill is subtracted forever.
