# Issue #30 — Logging a card payment leaves the payment bill unpaid on the runway

## Verdict

reproduced — after logging Card A's own $160 minimum payment, checking is $160
lighter and the card $160 lower, yet the "Card A payment" $160 bill is still
unpaid and still subtracted from safe-to-spend: the cycle allowance drops from
$327/day to $316/day instead of staying flat.

## Steps executed

1. Reset demo. Demo Card A is the issue's exact setup: balance **$1,240**,
   dueDay Aug 11, `payInFull` off, `minPay` **160**; the unpaid **"Card A
   payment" $160** bill exists (screenshot 01, `state-before.json`;
   checking $6,000).
2. Cards page → Card A → **Log payment**, amount 160, source Main checking
   (screenshot 02) → **Log it** (`POST /cards/:id/log-payment`).
3. Read `/me/state` (`state-after.json`): checking **$5,840**, Card A
   **$1,080**, and the bill is `amount: 160, paid: false` — `syncCardBill`
   re-pinned it to `minPay` without marking it paid.
4. Cards page after: balance $1,080.00 but the chip still reads
   **"$160.00 due Aug 11"** with "updated today ✓" beneath it (screenshot 03).
5. Bills page after: "Card A payment $160.00 · due Aug 11", checkbox unticked,
   header "This month $1,284.49 left of $1,296.48" (screenshot 04).
6. Runway after: hero sub "this cycle alone would allow **$316/day**" and the
   timeline still carries "Card A payment $160.00 · Aug 11" (screenshot 05).

## Observed vs expected

The runway's safe figure is `balance − bills due before payday − set-asides`,
with pre-payday bills = 950+74+45+160+15.49+40 = $1,284.49 and set-asides =
$91 (Japan) + $40 (E-fund) = $131. Before: 6000 − 1284.49 − 131 = **$4,584.51**
(→ "this cycle alone would allow $327/day"). Expected after logging the $160:
the bill flips to paid, so 5840 − 1124.49 − 131 = **$4,584.51** — unchanged,
because the payment merely settled an already-counted obligation. Observed:
the bill stays unpaid, so 5840 − 1284.49 − 131 = **$4,424.51**, i.e. the same
$160 is charged twice (once out of the balance, once as a still-pending bill),
and the on-screen cycle allowance drops $327/day → $316/day (floor(4424.51/14)).
The two paths for one intent disagree: paying via Bills marks the bill paid
(`payBill`), while Cards → Log payment never touches `paid` and `syncCardBill`
rewrites the bill back to the $160 minimum.

## Screenshots

- 01-before-bill-160-unpaid.png — Bills page before: "Card A payment $160.00 · due Aug 11" unpaid, balance pill $6,000.00.
- 02-log-payment-160-from-checking.png — Cards page: Log payment form on Card A, $160 from Main checking.
- 03-card-1080-but-160-still-due.png — after: Card A balance $1,080.00, tag still "$160.00 due Aug 11", "updated today ✓", pill $5,840.00.
- 04-bill-still-unpaid-after-payment.png — Bills page after: the $160 bill still unpaid; "This month $1,284.49 left of $1,296.48".
- 05-runway-still-subtracts-160.png — Runway after: "this cycle alone would allow $316/day" (was $327/day) and Card A payment still on the timeline.
