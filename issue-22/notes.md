# Issue #22 — "Earn the rest" enables the planner CTA but records no obligation

## Verdict

reproduced — earn alone flipped the gap to "Covered ✓" and enabled the CTA,
and locking the plan wrote nothing but the goal: no transaction, no bill, no
earn record of any kind.

## Steps executed

1. Reset demo, wiped to minimal (no cards, no goals), profile patched to
   `payAmount 2000`, `primaryBalance 2000`; added a $4,000 Rent due 2026-08-22
   via `POST /bills` to open the planner gap. With no cards and no pausable
   wishes, "Earn the rest" is the only coverage lever — the issue's "target
   large enough that the pause and card levers cannot cover it".
2. Saved `/me/state` as `state-before-lock.json` (0 goals, 16 txns, 1 bill).
3. UI, Goals → Plan a big expense: "a necessity", "New transmission", target
   8000, 12 months (August 2027). Gap line: "Still short $89.68 per paycheck —
   pick another lever"; CTA "Lock this plan in" rendered disabled
   (screenshot 01).
4. Selected only the "Earn the rest" lever (its copy: "about $180.00/mo more —
   log it with the + as money in when it lands"). Gap line became "Covered ✓"
   and the CTA reported `disabled? false` (screenshot 02).
5. Clicked "Lock this plan in". Saved `/me/state` as `state-after-lock.json`.
6. Diffed before/after state; captured Goals, Runway and Activity pages.

## Observed vs expected

Observed: the only change to state is one new goal — `{name: "New
transmission", target: 8000, saved: 0, per: 334, financed: 0, financedFrom:
null}`. New transactions: `[]`. New bills: `[]`. The earn lever's promised
"about $180.00/mo more" appears nowhere in the persisted state, matching the
handler (`apps/api/src/services/start-plan.ts` never reads `earn`). Expected:
either the extra earnings are recorded so the runway can track progress
against them, or earn does not count as coverage and the CTA stays disabled.
The recorded `per = 334` = `ceil(8000 / (12 × 2))` is exactly the figure the
planner had just computed the user cannot afford (short $89.68/paycheck before
the lever), so the moment the plan lands the runway flips to **-$11/day** with
"your goals + bills need $147.68 more than each paycheck brings in"
(screenshot 04) — the plan looked viable on screen and is unviable on landing.
The earn lever check ($89.68 short → `earnMonthly = ceil(89.68 × 2 / 10) × 10
= $180/mo`) confirms the lever text was computed and then discarded.

## Screenshots

- 01-planner-still-short-before-earn.png — necessity $8,000/12mo: "Still short $89.68 per paycheck — pick another lever", CTA greyed out.
- 02-earn-only-covered-cta-enabled.png — only "Earn the rest" ticked: gap line "Covered ✓", CTA active, no other lever selected.
- 03-goal-created-after-lock.png — Goals page after lock: "New transmission" goal exists with $334/paycheck set-aside.
- 04-runway-after-lock.png — runway immediately after: -$11/day, "goals + bills need $147.68 more than each paycheck brings in".
- 05-activity-no-earn-recorded.png — Activity feed: no earn income, expectation, or obligation was recorded.
