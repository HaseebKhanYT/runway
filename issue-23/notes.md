# Issue #23 — Promotional APR expires one day early

## Verdict

reproduced — with `promoEnd` = today (the promo's final day, still in force),
every promo-aware surface treats the card as post-promo at the standard 24.99%.

## Steps executed

1. Reset demo, wiped to minimal, `payAmount 2000` / `primaryBalance 2000`,
   added $4,000 Rent due 2026-08-22 (planner gap opener).
2. UI, Cards page: added "Card P" — APR 24.99, limit 10000, balance 500, no
   due day, promo switch on, promo APR 0, 1 month left.
3. SQL (this user's row only):
   `UPDATE "Card" SET "promoEnd" = '2026-08-02 00:00:00' WHERE "userId" = 'user_3HAsUFEqcSzztjGdDc21TDwYBIe' AND name = 'Card P';`
   — promoEnd = today, 2026-08-02. Serialized state confirms
   `promoRate: 0, promoEnd: "2026-08-02"` (`card-promoEnd-today.json`).
4. Reloaded Cards (screenshot 01), then opened the planner (necessity, $8,000,
   12 months) and read Card P's lever (screenshot 02).
5. Contrast run: same UPDATE with `promoEnd = '2026-08-03 00:00:00'`
   (tomorrow, one day left), reloaded Cards (screenshot 03) and the planner
   (screenshot 04).

## Observed vs expected

Observed with promoEnd = today: APR tag reads "24.99% APR", the status line
reads "interest ≈ $10.00/mo at 24.99%" ($500 × 24.99% / 12 ≈ $10.41 → $10),
and the planner lever reads "Put the rest on Card P · 24.99% APR / ≈$270.00
interest over 12 mo" (`ceil(2153 × 24.99/100 × 12/24) = 270`). Expected: a
promotion whose end date is today is still in effect today — tag "0% until Aug
· then 24.99%", lever "0% until Aug 2026 / ≈$2,153.00 financed · $0 interest",
$0/mo interest. The contrast run proves the boundary: moving promoEnd forward
one single day (to tomorrow) flips all three surfaces to the promo copy
(screenshots 03/04), so the live window is `daysUntil > 0` — the final day is
excluded, i.e. the promo dies one day early exactly as the issue states, in
`effectiveApr` (`packages/shared/src/cards.ts:6`) and its two duplicates
(`apps/web/src/lib/card-lines.ts:43`, `apps/web/src/app/(app)/cards/page.tsx:92`).

## Screenshots

- 01-cards-promo-ends-today-treated-dead.png — promoEnd = 2026-08-02 (today): tag "24.99% APR", line "interest ≈ $10.00/mo at 24.99%".
- 02-planner-lever-standard-apr-on-final-promo-day.png — planner lever on the promo's final day: "24.99% APR · ≈$270.00 interest over 12 mo".
- 03-cards-promo-ends-tomorrow-treated-live.png — promoEnd = 2026-08-03 (one day later): tag "0% until Aug · then 24.99%", line "0% ends Aug 2026 (1 mo)".
- 04-planner-lever-promo-live-with-one-day-left.png — same lever with one day left: "0% until Aug 2026 · ≈$2,153.00 financed · $0 interest".
