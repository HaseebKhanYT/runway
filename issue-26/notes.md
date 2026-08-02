# Issue #26 — payoffProjection returns NaN for a 0% card and overstates interest otherwise

## Verdict

reproduced — a 0% card renders "clear by Invalid Date · ≈$NaN interest on the
way" on the Cards page, and the demo's own Card A shows ≈$200.00 where the true
amortized interest is $87.78.

## Steps executed

1. Reset demo. The demo's Card A is exactly the repo's own test case: APR
   17.9, balance 1240, minPay 160, with a $160 payment bill.
2. UI, Cards page: Card A's status line reads
   **"At $160.00/mo → clear by May 2027 · ≈$200.00 interest on the way"**
   (screenshot 01).
3. UI: added "Card Z" through the form — APR **0**, limit 5000, balance
   **1000**, due day 11 (today+9), payment **100**/mo. `syncCardBill` created
   the $100 "Card Z payment" bill (`card-z.json`).
4. Card Z's status line reads
   **"At $100.00/mo → clear by Invalid Date · ≈$NaN interest on the way"**
   (screenshot 02, which shows both cards in one frame).
5. Ground truth computed by month-by-month amortization (final month pays only
   the remaining balance), logged by the repro script.

## Observed vs expected

NaN case: with `apr = 0`, `r = 0`, the guard `monthlyPayment <= balance * r`
becomes `100 <= 0` (false), so the formula evaluates
`-Math.log(1 − 0) / Math.log(1)` = `-0/0` = NaN; `months` and `interest` both
propagate it, `new Date(y, m + NaN, 1)` renders "Invalid Date" and the money
formatter renders "$NaN". Expected: $1,000 at $100/mo and 0% clears in **10
months with $0.00 interest** — "At $100.00/mo → clear by Jun 2027 · ≈$0.00
interest on the way". Overstatement case: true amortization of $1,240 at 17.9%
with $160/mo is **9 payments (8 full + one partial) totalling $87.78
interest**; the function instead returns `160 × ceil(8.296) − 1240 = $200.00`— charging a full $160 for the fractional final month — which is what the
Cards page shows, an overstatement of ×2.28. The third defect (using`c.apr`instead of`effectiveApr`, masked because `cardLine`returns from its promo
branch first) is code-visible at`packages/shared/src/cards.ts:20` but has no
on-screen surface today, consistent with the issue's own description.

## Screenshots

- 01-card-a-interest-overstated-200.png — demo Card A: "At $160.00/mo → clear by May 2027 · ≈$200.00 interest on the way" (true figure: $87.78).
- 02-card-z-0apr-nan-status-line.png — Card Z (0% APR, $1,000 balance, $100/mo): "At $100.00/mo → clear by Invalid Date · ≈$NaN interest on the way", next to Card A's $200 line.
