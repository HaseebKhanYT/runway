# Issue #36 — Negative card headroom writes a goal with negative progress

## Verdict

`reproduced` — a plan financed on an over-limit card creates a goal with
`saved: -500, financed: -500, financedFrom` set; the Goals page shows
"−$500.00 / $1,000.00" and demands $1,500 for a $1,000 goal.

## Steps executed

1. Reset demo (`POST /reset-demo`).
2. Added the issue's card through the real Cards-page form ("+ Add a card"):
   "Maxed card", APR 24, **limit $1,000, balance $1,500**. Accepted — neither
   the form (`formValid` checks only name + limit > 0) nor `cardUpsertSchema`
   cross-checks balance against limit. Headroom: −500. (#31 shows the same
   over-limit state is also reachable via the crunch over-advance.)
3. UI caveat, captured: the planner's card levers filter on headroom > 0
   (apps/web/src/lib/planner.ts:119), so with a gapping necessity on screen
   the levers offered only Card B and Card A — the over-limit card cannot be
   _selected_ in the panel. The panel's own endpoint has no such filter, so
   step 4 posts what the panel would send with that card id.
4. `POST /planner/start {name: "Transmission fix", target: 1000, months: 2,
kind: "necessity", pausedIds: [], cardId: <Maxed card>, earn: false}` →
   **200**.
5. Read `/me/state` and the Goals page; reset demo after.

## Observed vs expected

Expected: a card with no headroom finances nothing — `financed` 0, `saved`
starts at 0, `financedFrom` null, so the new $1,000 goal reads "$1,000.00 to
go · $250.00 per paycheck × 4 left". Observed: start-plan.ts:23-24 computes
`headroom = floor(1000 − 1500) = −500` and `financed = min(−500,
ceil(1000)) = −500`; the `financed > 0` guard correctly skipped the card
charge (balance stayed $1,500) and created no financing bill, but the goal
row was written with **saved −500, financed −500, financedFrom "Maxed
card"**. On screen: readout "**−$500.00 / $1,000.00**"; `goalRemaining =
max(0, 1000 − (−500)) = 1500` → "**$1,500.00 to go · $375.00 per paycheck ×
4 left**" and "$1,500.00 required each month" — the phantom −500 inflates
every pace figure by 50%. `goalBarSplit` yields `finPct = (−500/1000)×100 =
−50`; React/CSSOM drops the invalid negative width (the first fill's inline
style contains no width declaration, computed 0px — see
`progressfill-widths.json`), so the bar renders empty rather than at a
negative width, but the corrupt figures drive everything around it. The
"fronted by" ledger line stays hidden (`financed > 0` gate), exactly as the
issue's Evidence section predicts.

## Screenshots

- 01-maxed-card-1500-of-1000-limit.png — Cards page: Maxed card, balance $1,500.00 of $1,000.00.
- 02-planner-levers-omit-overlimit-card.png — planner levers list Card B and Card A only; the over-limit card is unselectable in the UI (server accepts it anyway).
- 03-goal-minus-500-of-1000.png — "Transmission fix −$500.00 / $1,000.00", "$1,500.00 to go · $375.00 per paycheck × 4 left", empty bar.

API evidence: `state-goal-negative.json` (goal saved/financed −500,
financedFrom set, card balance unchanged, `financingBill: null`),
`progressfill-widths.json`.
