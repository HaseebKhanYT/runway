# Issue #18 — The financing bill has no cardId, so paying it never reduces the card balance

## Verdict

reproduced — paying the $667 "Hospital bill financing" installment from checking debited cash ($2,000 → $1,333) and left Card Z's balance at exactly $8,000.00.

## Steps executed

Real system date: 2026-08-02. Payday = 2026-08-16.

1. `POST /reset-demo`; deleted all demo bills/cards/goals via the API; `PATCH /profile {payAmount: 2000, primaryBalance: 2000}`.
2. `POST /bills` Rent $4,000 survival, dueDay 22 (after payday; only there so the planner's card lever renders).
3. `POST /cards` Card Z: limit 10000, balance 0, apr 24.99, dueDay 11, payInFull false. (Sync created a "Card Z payment" bill: $25, `cardId` set.)
4. UI, Goals: necessity "Hospital bill", target 8000, 12 months, selected "Put the rest on Card Z", clicked "Lock this plan in". `/me/state`: Card Z balance = 8000; bill "Hospital bill financing" $667, `cardId: null` (state-before-pay.json). Cards page screenshot 01.
5. UI, Bills: clicked the pay checkbox on "Hospital bill financing" ($667). Pay-source modal defaulted to Main checking ("$2,000.00 now · $1,333.00 left") — screenshot 02. Clicked "Mark paid".
6. Returned to Cards — screenshot 03; captured `/me/state` after (state-after-pay.json).

## Observed vs expected

Expected: paying an installment on a plan financed by Card Z should reduce Card Z's outstanding principal by the $667 paid (8000 → 7333; twelve installments → 0). Observed: `profile.primaryBalance` 2000 → **1333** (−667) while `cards[Card Z].balance` stayed **8000 → 8000**; the financing bill flipped to `paid: true` with `cardId: null`, so the `bill.cardId` branch in `apps/api/src/services/pay-bill.ts:13-19` never fires and the payment falls through to `adjustCashSource` as a pure cash debit. The bill was created without a card link in `apps/api/src/services/start-plan.ts:33-42`. The user is left paying twice for one debt: this $667/mo bill that clears nothing, plus the separate "Card Z payment" bill ($25 min due Aug 11, itself flagged "doesn't cover the interest") against the same untouched $8,000 principal.

## Screenshots

- 01-card-8000-before-payment.png — Cards page after locking the plan: Card Z balance $8,000.00 of $10,000.00 (top-bar balance chip $2,000.00).
- 02-pay-667-from-checking-modal.png — "Pay Hospital bill financing" modal: paying $667.00 from Main checking, "$2,000.00 now · $1,333.00 left".
- 03-card-still-8000-after-payment.png — Cards page after the payment: balance chip now $1,333.00, Card Z still $8,000.00 of $10,000.00, TOTAL DEBT $8,000.00.
