# Issue #159 — a card's payment bill is independently deletable

Reproduced and fixed on 2026-08-06 by the automated `daily-issue-fix` routine,
against `develop` @ `ae8a7fe` on a local dev stack (web `:3000`, api `:8787`,
Postgres demo database), signed in as the `+clerk_test` smoke account. Fix
branch: `fix/card-payment-bill-is-not-deletable`.

The demo fixture was extended with one friend loan
(`POST /loans {who: 'Sam', amount: 120, dueDate: '2026-08-18'}`) so that both
sorts of `kind: 'debt'` bill were on screen at once — the card-mirrored
`Card A payment` (`cardId` set) and the user-created `Pay back Sam`
(`cardId: null`).

## 01-before-cards-false-claim.png

After clicking `Delete Card A payment` on the Bills page at 1200px — one click,
no confirmation. The Cards page then reads:

> No due date set — Edit to add one · interest ≈ $18.00/mo at 17.9%

`GET /me/state` at that moment reported Card A unchanged:
`balance 1240, apr 17.9, dueDay 15, minPay 160, payInFull false`. The due day was
never unset; `cardLine` (`apps/web/src/lib/card-lines.ts:66-70`) only falls
through to that branch because the mirrored bill it looks for is gone.

Safe-to-spend moved **$69/day → $74/day** across the same delete, for a payment
that is still owed.

## 02-after-bills-desktop.png

Same page, same viewport, with the fix applied. The delete controls present are

    Rent, Electric, Phone, Spotify, Netflix, Gym, Pay back Sam

`Delete Card A payment` is absent. `Delete Pay back Sam` is not — a friend loan
is a debt bill the user owns and must stay deletable, which is why the fix tests
`bill.cardId == null` rather than `bill.kind !== 'debt'` as the issue proposed.

## 03-after-mobile-swipe.png

390px. An identical synthetic left swipe was dispatched at each row:

| row | `translateX` | actions revealed |
| --- | --- | --- |
| Rent (survival) | -140px | Edit, Delete |
| Pay back Sam (friend loan) | -70px | Delete |
| Card A payment (card bill) | 0px | none |

The screenshot shows the DEBT group with `Pay back Sam` held open on Delete and
`Card A payment` sitting unmoved directly above it.

Negative control: with the fix stashed, the same gesture on `Card A payment`
moved that row to **-70px and revealed Delete**.
