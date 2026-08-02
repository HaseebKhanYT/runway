# Issue #31 — POST /crunch/lock trusts a client-supplied advance and creates no repayment obligation

## Verdict

reproduced — `POST /crunch/lock` with `advance: 5000` against a card with $100
of headroom returned 200: card balance 900 → $5,900 on a $1,000 limit,
checking 500 → $5,500, a +$5,000 transaction categorised `Income`, and zero
new bills or goals — the debt exists nowhere as an obligation.

## Steps executed

1. Reset demo. `POST /cards` "Starter card": apr 24, limit **1000**, balance
   **900** ($100 headroom, no dueDay). `PATCH /profile
   {primaryBalance: 500}` → safe = 500 − 1284.49 − 131 = −915.49, so the
   dashboard shows the crunch panel: "$916.00 short" (`state-before.json`).
2. Selected the Starter card lever in the UI. The client clamps correctly:
   with the $100 headroom it shows **"Still short $816.00 — stack another
   lever"** and **Lock this plan stays disabled** (screenshot 01). That
   client-side `Math.min(rem, headroom)` is the only clamp anywhere.
3. From the signed-in page, sent the request the panel would send but with a
   manipulated figure: `POST /crunch/lock {pausedGoalIds: [], cardId:
<starter id>, advance: 5000}` → **200 OK**.
4. Read `/me/state` (`state-after.json`): checking **$5,500**, Starter card
   **$5,900 of $1,000**; bills 7 → 7, goals 2 → 2 (nothing created); new txn
   `{label: "Advance from Starter card", amount: 5000, cat: "Income"}`
   (`advance-txn.json`).
5. Cards page: Starter card at **$5,900.00 of $1,000.00**, header "120% of
   limit used", available $0.00 (screenshot 02). Runway: crunch gone, balance
   pill $5,500.00, activity shows "Advance from Starter card **+$5,000.00**"
   as income (screenshot 03). Bills page: no repayment bill of any kind
   (screenshot 04).

## Observed vs expected

Expected: the server clamps the advance to real headroom — min(5000,
floor(1000 − 900)) = **$100** — the same clamp `startPlan` applies to its own
financing figure, and records the borrowed money as an obligation (the shape
`POST /loans` uses: cash in plus a one-time personal "pay back" bill).
Observed: the schema's only constraint is finite-and-nonnegative, and
`lockCrunchPlan` applies the client's number verbatim — $5,000 lands on a
$1,000-limit card (5.9× over limit, screenshot 02), checking swells to
$5,500, and the borrowing is booked as `cat: 'Income'` with no bill and no
goal, so the crunch "resolves" by inventing unrepayable money that also
poisons the activity view and any income-based number downstream. The UI's
own math proves the server wrong in one frame: screenshot 01 shows the panel
refusing to lock more than $100 while the API accepted $5,000.

## Screenshots

- 01-crunch-ui-clamps-advance-to-100.png — crunch panel "$916.00 short", Starter card lever selected, "Still short $816.00 — stack another lever", Lock disabled: the client clamps to $100 headroom.
- 02-card-5900-of-1000-limit.png — after the forged POST: Starter card $5,900.00 of $1,000.00, "120% of limit used", $0.00 available, total debt $7,790.00.
- 03-advance-5000-booked-as-income.png — Runway after: crunch gone, balance pill $5,500.00, activity row "Advance from Starter card +$5,000.00" as income.
- 04-no-repayment-bill.png — Bills page after: the demo's bills only; no repayment obligation was created.
