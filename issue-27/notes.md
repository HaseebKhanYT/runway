# Issue #27 — Planner math is hardcoded to two paychecks per month

## Verdict

reproduced — at weekly cadence the planner quotes $100 per paycheck for $2,400
over 12 months (the biweekly answer), and `POST /planner/start` persists
`per: 100`; the correct weekly figure is ≈$46.

## Steps executed

1. Reset demo, then `PATCH /profile` with `{cadence: 'weekly', payAmount: 1000}`
   (the Settings page's own endpoint; screenshot 01 shows Weekly active and
   paycheck $1,000).
2. Goals page → planner card: picked **a necessity**, name "New laptop",
   target **2400**, stepped the month picker to **August 2027** (12 months).
3. The per-paycheck line rendered:
   **"That's $100 per paycheck — it fits without denting your daily number."**
   (screenshot 02).
4. Clicked **Start this plan** (`POST /planner/start`). Read `/me/state`:
   the stored goal is `{name: "New laptop", target: 2400, per: 100,
due: "2027-08-01"}` — the server's `body.target / (body.months * 2)`
   constant (`state-after-start.json`).
5. The resulting goal card immediately contradicts the planner: it shows
   **"$47.00 per paycheck × 52 left"** for the very same goal (screenshot 03).

## Observed vs expected

Observed: the planner divides by `months × PAYCHECKS_PER_MONTH` with the
constant 2, so $2,400 / (12 × 2) = **$100 per paycheck**, and the server
stores `per = ceil(2400 / 24) = 100`. Expected: a weekly earner gets
30.44 / 7 ≈ 4.35 paychecks a month, so $2,400 / (12 × 4.35) ≈ **$46 per
paycheck**. The app's own cadence-aware code agrees with $46: once the goal
exists, `goalPerPaycheck` computes ceil($2,400 / 52 weekly checks) = **$47**,
which is what the goal card displays — screenshot 03 shows the two figures
($100 promised at planning time, $47 required in reality) disagreeing by
2.1×, and screenshot 02 shows the demo's Japan trip card ($46.00/paycheck for
an identical $2,400 target) right next to the planner's $100 claim. The
mismatch also poisons `cap`/`initialGap` (the planner mixed the biweekly $100
against weekly cadence-aware `cycleSurplus` and `goalPerPaycheck` capacity
figures), and `perDayDelta` divides by a hardcoded 14-day cycle.

## Screenshots

- 01-settings-weekly-1000.png — Settings: pay cycle Weekly, paycheck amount $1,000.
- 02-planner-says-100-per-paycheck.png — planner: "That's $100 per paycheck" for $2,400 / 12 mo at weekly cadence; Japan trip card beside it correctly shows $46.00/paycheck for the same $2,400.
- 03-goal-card-contradicts-planner.png — after Start: "New laptop" card shows "$47.00 per paycheck × 52 left" while the API stored per: 100.
