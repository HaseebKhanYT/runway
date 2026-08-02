# Issue #21 — A card's minimum payment freezes at the value it had when the bill was created

## Verdict

reproduced — the payment bill stayed at $25 after an $8,000 charge, and the
Evidence section's phantom-$25-on-zero-balance defect reproduced too.

## Steps executed

1. Reset demo (`POST /reset-demo`), wiped to minimal state via the app's own
   DELETE endpoints, patched profile to `payAmount 2000`, `primaryBalance 2000`.
2. Added a $4,000 Rent bill due 2026-08-22 (after the 2026-08-16 payday) via
   `POST /bills` — scaffolding only, so the planner's FIND THE MONEY card lever
   appears (demo `initialGap` is otherwise negative).
3. UI, Cards page: added "Card X" through the form — APR 24.99, limit 10000,
   balance 0, due day 11 (today+9), "$ payment / mo" blank, "Always pay in
   full" off. (`POST /cards` → `syncCardBill` created the payment bill.)
4. UI, Bills page: "Card X payment" reads **$25.00** while the card balance is
   $0 (screenshot 01). State JSON saved as `state-before-charge.json`.
5. UI, Goals → Plan a big expense: "a necessity", name "Hospital bill", target
   8000, 12 months → FIND THE MONEY → selected lever "Put the rest on Card X ·
   24.99% APR" → "Covered ✓" → clicked "Lock this plan in". Card balance went
   0 → 8000 (state JSON `state-after-charge.json`).
6. UI, Bills page again: "Card X payment" still **$25.00** (screenshot 03).
   Cards page: balance $8,000.00 of $10,000.00 next to a "$25.00 due Aug 11"
   tag (screenshot 04).

## Observed vs expected

Observed: after charging $8,000 to Card X, the "Card X payment" bill is still
$25.00 (`state-after-charge.json`: card balance 8000, bill amount 25). Expected:
the pencil-in minimum should track the balance — `minPaymentGuess(8000) =
max(25, ceil(8000 × 0.03)) = $240` — so the bill should read about $240 and the
runway should carry that commitment. The app itself knows $25 is wrong: the
card's own status line says "$25.00/mo doesn't cover the interest — raise the
payment" ($8,000 at 24.99% accrues ≈$167/mo interest, so $25 never amortizes),
yet `syncCardBill` keeps reusing `existing.amount` instead of recomputing the
guess. Second defect confirmed: at creation with balance $0 the bill was
created at `minPaymentGuess(0) = $25`, a phantom obligation for a card that
owes nothing (screenshot 01, `state-before-charge.json`).

## Screenshots

- 01-bills-phantom-25-on-zero-balance.png — Bills page right after adding the card: "Card X payment $25.00" while the card balance is $0.
- 02-planner-charge-8000-to-card-x.png — planner lever "Put the rest on Card X · 24.99% APR" selected, "Covered ✓", just before locking the plan in.
- 03-bills-still-25-after-8000-charge.png — Bills page after the $8,000 charge: "Card X payment" still $25.00.
- 04-card-tile-8000-balance-25-due.png — card tile: balance $8,000.00 of $10,000.00, tag "$25.00 due Aug 11", status line "$25.00/mo doesn't cover the interest — raise the payment".
