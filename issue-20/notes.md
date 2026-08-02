# Issue #20 — Pay-in-full cards put the entire financed balance on the runway immediately

## Verdict

reproduced — locking a 12-month, $8,000 plan on a pay-in-full card produced a "Card V payment" bill of $8,000.00 due 9 days out, and a 0% promo made no difference to that bill.

## Steps executed

Real system date: 2026-08-02. Payday = 2026-08-16 (daysToPayday 14).

1. `POST /reset-demo`; deleted all demo bills/cards/goals via the API; `PATCH /profile {payAmount: 2000, primaryBalance: 2000}` (biweekly).
2. `POST /bills` Rent $4,000, survival, dueDay 22 (after payday; only opens the planner gap so the card lever renders).
3. `POST /cards` Card V: limit 10000, balance 0, apr 24.99, dueDay 11, **payInFull true**, plus a live promo (`promoRate 0, promoMonths 12`) to exercise the issue's Evidence claim.
4. UI, Goals: necessity "Hospital bill", target 8000, 12 months out. The lever read "Put the rest on Card V · 0% until Jul 2027 — ≈$2,153.00 financed · $0 interest if cleared before the promo ends" (screenshot 01). Locked the plan.
5. Opened Cards (screenshot 02) and Runway (screenshot 03); `/me/state` saved as state-after-lock.json.

## Observed vs expected

Expected: a plan financed over 12 months is an installment obligation — this cycle's runway should carry roughly one installment, ceil(8000/12) = **$667**, so safe ≈ 2000 − 667 = $1,333. Observed: `syncCardBill` (`apps/api/src/services/card-bill-sync.ts:22-29`) pinned the "Card V payment" bill to the card's whole live balance: **$8,000.00, due 2026-08-11** — 9 days away, before payday — because `payInFull` is true and nothing records that the balance is a term plan. Runway: safe = 2000 − (8000 + 667 financing bill) = −6,667 → crunch panel "**$6,667.00 short** — Not enough for Card V payment ($8,000.00, due Aug 11)". The Cards tile literally promises "Pays in full Aug 11 — $8,000.00, $0 interest" for money the planner just spread over 12 months. Promo indifference confirmed: `effectiveApr` = 0 (lever showed "0% until Jul 2027 · $0 interest") yet the payment bill is the same $8,000 a 24.99% card produces — the promo affected display copy only. (The $667 "Hospital bill financing" bill also present in the state is issue #16's double-count; even ignoring it, the $8,000 pay-in-full bill alone makes safe = 2000 − 8000 = −6,000.)

## Screenshots

- 01-planner-0-promo-card-lever.png — lever selected: "Put the rest on Card V · 0% until Jul 2027", "≈$2,153.00 financed · $0 interest if cleared before the promo ends", "Covered ✓".
- 02-payment-bill-8000-due-in-9-days.png — Cards page after lock: "$8,000.00 due Aug 11" tag, "Pays in full Aug 11 — $8,000.00, $0 interest", balance $8,000.00 of $10,000.00.
- 03-runway-whole-principal-on-cycle.png — crunch panel "$6,667.00 short — Not enough for Card V payment ($8,000.00, due Aug 11)"; timeline shows the whole $8,000 principal sitting before Payday Aug 16.
