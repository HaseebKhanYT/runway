# Issue #35 — Goals paused by a plan never resume

## Verdict

`reproduced` — both wish goals stayed `paused: "Car repair"` through the
plan's deletion and two confirmed paydays; nothing in the codebase clears a
named pause (payday.ts:75-79 only lifts the `'__crunch'` sentinel).

## Steps executed

1. Reset demo (`POST /reset-demo`). Demo has the two wish goals the issue
   asks for: Japan trip (per $85) and Emergency fund (per $40), both active.
2. Goals → planner: "a necessity", "Car repair", $8,000, 1 month
   (September 2026). Gap shown: "$4000 per paycheck needed — $735 more…".
   Selected **Pause "Emergency fund" set-asides** ("frees $40.00 / paycheck
   _while this plan runs_") and **Pause "Japan trip" set-asides** ("frees
   $91.00 / paycheck *while this plan runs*"), plus "Earn the rest" to cover
   (no card, to keep financing out of scope) → "Covered ✓ · $131.00/pay freed
   from paused wishes" → **Lock this plan in**.
3. `/me/state`: both wishes now `paused: "Car repair"` (start-plan.ts:12-17
   writes the plan _name_).
4. Payday 1: `PATCH /profile {nextPay: 2026-08-02}` (today), then confirmed
   through the payday modal on the runway timeline ("Yes — $1,700.00
   landed"). Result: Car repair goal funded $4,000; **both wishes still
   paused, still $400/$860 saved** — payday funds skip paused goals and the
   un-pause query matches only `paused: '__crunch'`.
5. The plan finishes: deleted the "Car repair" goal from the Goals page.
   Both wishes **still** `paused: "Car repair"` — now referencing a goal that
   no longer exists.
6. Payday 2 (next cycle, nextPay moved to today again, confirmed via modal).
   Both wishes **still** `paused: "Car repair"`.
7. Reset demo.

## Observed vs expected

Expected (the lever's own copy): the set-asides are paused _while this plan
runs_ — so they resume when the plan is done, at latest at the first payday
after the plan goal is deleted. Observed: across payday 1 → plan deletion →
payday 2, `Goal.paused` stayed `"Car repair"` for both wishes and their
`saved` never moved ($400 and $860 before and after both paydays — the
paychecks contributed $0 to them, while the plan goal took $4,000 at payday
1). The Goals page permanently shows '⏸ Paused — feeding "Car repair"'
against a goal that no longer exists, and safe-to-spend stays inflated by the
skipped set-asides (the $131/pay the planner "freed") indefinitely, since
paused goals are excluded from `setAside` (runway.ts:29-31, 50-53).

## Screenshots

- 01-pause-levers-while-this-plan-runs.png — planner with both pause levers checked, each promising "…/ paycheck while this plan runs", Covered ✓.
- 02-both-wishes-paused-feeding-plan.png — after lock-in: both wish goals show '⏸ Paused — feeding "Car repair"'.
- 03-payday-confirm-modal.png — the payday confirmation modal for payday 1.
- 04-still-paused-after-plan-gone-two-paydays.png — after the plan is deleted and two paydays confirmed: both goals still '⏸ Paused — feeding "Car repair"', saved unchanged.

API evidence: `state-after-lock.json`, `state-goals-timeline.json`
(goal-by-goal `paused`/`saved` at each step: afterLock → afterPayday1 →
afterPlanDeleted → afterPayday2).
