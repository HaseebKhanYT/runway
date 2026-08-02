# Issue #29 — Paying a card's own payment bill from that same card debits cash as well

## Verdict

reproduced — paying the $50 "Visa payment" bill with the Visa itself as source
dropped the card balance to $450 AND checking to $5,950; the $50 left the
user's money twice.

## Steps executed

1. Reset demo. `POST /cards` "Visa": apr 22, limit 2000, balance **500**,
   dueDay Aug 12, minPay 50. `syncCardBill` created the unpaid **"Visa
   payment" $50** bill with `cardId` set. Noted checking = **$6,000**
   (screenshot 01, `state-before.json`).
2. Set the bill's source to the card itself:
   `PATCH /bills/:id {payFrom: <visa card id>}` — the API accepts any string
   there. (The pay-source modal's row list filters out the bill's own card,
   but it preselects `bill.payFrom` unfiltered, so this is the "choose Visa
   itself" path that survives the UI; `POST /bills/:id/pay {source: <visa
id>}` is equally accepted directly.)
3. Bills page → clicked the pay checkbox on "Visa payment". The modal opened
   with **no source visually selected** (Visa is hidden from the list yet is
   the active source) — screenshot 02. Clicked **Mark paid**.
4. Read `/me/state` (`state-after.json`): checking **$5,950**, Visa balance
   **$450**, bill paid. Runway page shows balance pill $5,950.00 and the
   activity row "Visa payment −$50.00 · from Visa" (screenshot 03); Cards page
   shows Visa at $450.00 of $2,000.00 (screenshot 04).

## Observed vs expected

Observed: one $50 payment debited both ledgers — Visa 500 → **450** (the
`bill.cardId` block) and checking 6,000 → **$5,950** (the fall-through to
`adjustCashSource`, which has no card branch and treats a card source as
checking). Expected: paying a card with itself should be rejected or at most
a no-op on cash — checking must stay $6,000. The guard
`resolved.kind === 'card' && resolved.id !== bill.cardId` in `payBill` is
false when the source card IS the bill's card, so a resolved source of kind
`card` reaches `adjustCashSource` in violation of that function's own
documented contract ("Card sources are handled by callers"). The activity row
even attributes the debit to "from Visa" while the money actually left
checking (screenshot 03). `unpayBill` has the identical guard, so the reverse
path double-credits the same way.

## Screenshots

- 01-before-visa-500-checking-6000.png — Cards page before: Visa $500.00 of $2,000.00, "$50.00 due Aug 12", balance pill $6,000.00.
- 02-pay-modal-source-is-visa-itself.png — pay modal for "Visa payment": the bill's own card is absent from the source list and nothing is visibly selected, yet the active source is the Visa itself.
- 03-checking-5950-activity-from-visa.png — after: balance pill $5,950.00; activity "Visa payment −$50.00 · from Visa" — cash left checking on a card-sourced payment.
- 04-after-visa-450-and-checking-5950.png — after: Visa balance $450.00 of $2,000.00 while the header pill still shows $5,950.00 — both debited.
