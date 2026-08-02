# Issue #25 — Non-zero promotional rates are treated as "not a promo"

## Verdict

reproduced — with a live 4.9% promo, the planner lever's title says "24.99%
APR" while its own subtitle is computed at 4.9%, and the crunch lever both
labels and computes at the standard 24.99%.

## Steps executed

1. Reset demo, wiped to minimal, `payAmount 2000` / `primaryBalance 2000`,
   added $4,000 Rent due 2026-08-22 (planner gap opener).
2. UI, Cards: added "Card R" — APR 24.99, limit 10000, balance 500, promo on,
   promo APR **4.9**, 6 months left. State: `promoRate: 4.9, promoEnd:
"2027-01-29"` (`card.json`). The Cards page itself treats this promo as
   live: tag "4.9% until Jan · then 24.99%" (screenshot 01).
3. UI, planner (necessity "Probe", $8,000, 12 months): Card R's lever reads
   **"Put the rest on Card R · 24.99% APR / ≈$53.00 interest over 12 mo"**
   (screenshot 02).
4. Triggered a crunch: `PATCH /profile` `primaryBalance 500`, added a $2,000
   "Car repair" bill due 2026-08-05 (before the 08-16 payday) → runway shows
   "CASH CRUNCH · $1,500.00 short". Card R's crunch lever reads **"Cover the
   rest with Card R · 24.99% APR / ≈$31.00/mo interest until you clear it"**
   (screenshot 03).

## Observed vs expected

Planner: the financeable amount here is $2,153 (`ceil(89.68 gap/paycheck × 24
paychecks)`). The observed subtitle ≈$53.00 is exactly the promo-rate figure —
`ceil(2153 × 4.9/100 × 12/24) = ceil(52.7) = 53` — while at the title's
advertised 24.99% it would be `ceil(2153 × 24.99/100 × 12/24) = $270` (the
figure this same lever showed in the issue-23 run when the promo really was
dead). Title and subtitle of one button are computed at two different rates.
Expected: title "4.9% until Jan 2027" with the $53 figure. Crunch: shortfall
$1,500, advance $1,500; observed "≈$31.00/mo" = `round(1500 × 24.99/1200)` —
the standard APR — where the live promo gives `round(1500 × 4.9/1200) ≈ $6/mo`;
the label also says "24.99% APR". Expected: "4.9% promo" and ≈$6/mo. Both
surfaces sort cheapest-first by `effectiveApr` (4.9) yet describe the card by
`c.apr` because their promo test is `eff === 0`, which excludes any non-zero
promotional rate — while the Cards page (screenshot 01) simultaneously shows
the same card as "4.9% until Jan", so the app contradicts itself across pages.

## Screenshots

- 01-cards-4.9-promo-tag.png — Cards page: tag "4.9% until Jan · then 24.99%", line "4.9% ends Jan 2027 (6 mo)" — the 4.9% promo is live and known.
- 02-planner-lever-title-vs-sub-contradict.png — planner lever: title "24.99% APR", subtitle "≈$53.00 interest over 12 mo" (a 4.9% figure).
- 03-crunch-lever-standard-apr-on-live-promo.png — crunch panel "$1,500.00 short": lever "Cover the rest with Card R · 24.99% APR · ≈$31.00/mo interest" despite the live 4.9% promo.
