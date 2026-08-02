# Issue #28 — Monthly cadence undercounts bills, and unknown cadences silently become biweekly

## Verdict

reproduced — both halves: a monthly earner's $3,000 of bills prorates to
$2,956.64 per cycle (spare reads $1,060 where $1,000 is exact), and a
DB-corrupted cadence of `fortnightly` silently renders as biweekly numbers
($187/day and a fabricated "payday in 14d") with no error anywhere.

## Steps executed

1. Reset demo, then stripped to minimal state through the app's own endpoints
   (deleted all bills, cards, goals) and `PATCH /profile` with
   `{cadence: 'monthly', payAmount: 4000, nextPay: today+30 = 2026-09-01}`.
2. `POST /bills` three survival bills all due on the 22nd (off=20): Rent
   $2,000, Insurance $550, Utilities $450 — exactly **$3,000/month**
   (screenshot 01, `state-monthly.json`).
3. Runway page: hero shows **$34/day**; payday pill correctly says "payday in
   30d" (screenshot 02).
4. Goals page: header shows **"$1,060.00 left over after bills & goals"**
   (screenshot 03).
5. Unknown-cadence half: `PATCH /profile` rejects bad cadences (Zod enum), so
   corrupted this user's row directly:
   `docker exec runway-postgres-1 psql -U runway -d runway -c "UPDATE \"Profile\" SET cadence='fortnightly' WHERE \"userId\"='user_3HAsUFEqcSzztjGdDc21TDwYBIe';"`
   `/me/state` then returns `cadence: "fortnightly"` verbatim
   (`state-fortnightly.json`).
6. Reloaded Runway: hero shows **$187/day**, pill says **"payday in 14d"**,
   and the timeline invents a **"Payday · Aug 16 +$4,000"** although the
   profile's `nextPay` is Sep 1 (screenshot 04). Settings shows no active
   pay-cycle chip — the only visible hint anything is off (screenshot 05).
7. Reset demo (verified cadence back to `biweekly` — the psql edit is fully
   restored).

## Observed vs expected

Monthly half: with $4,000 pay and $3,000/month of bills and zero set-asides,
one cycle is one month, so `cycleSurplus` should be exactly **$1,000** and the
Goals header should read $1,000/month spare. The app computes
`billsPerCycle = 3000 × cycleDays('monthly')/DAYS_PER_MONTH = 3000 × 30/30.44
= $2,956.64`, so `cycleSurplus` = **$1,043.36** — 1.45% of the bills vanish in
the optimistic direction. On screen: the Goals header re-multiplies by
30.44/30 (`spareMonthly`), compounding to **$1,060.00** shown vs $1,000 true
(screenshot 03), and the hero shows floor(1043.36/30) = **$34/day** vs the
correct floor(1000/30) = **$33/day** (screenshot 02). Unknown-cadence half:
`cycleDays`'s `default:` branch turns `fortnightly` into a 14-day cycle, so
the same $1,000/month-surplus user is shown floor((4000 − 3000×14/30.44)/14)
= **$187/day** — 5.7× the truthful monthly figure — plus a payday pill and
timeline payday two weeks out that do not exist. Expected: an invalid cadence
should fail loudly, not produce plausible biweekly numbers.

## Screenshots

- 01-bills-3000-per-month.png — Bills page: SURVIVAL $3,000.00 / month (Rent, Insurance, Utilities, all due Aug 22).
- 02-runway-34-per-day.png — monthly cadence: hero $34/day (expected $33/day), pill "payday in 30d".
- 03-goals-spare-inflated.png — Goals header "$1,060.00 left over after bills & goals" (expected $1,000.00).
- 04-fortnightly-cadence-187-per-day.png — cadence `fortnightly` in the DB: hero $187/day, pill "payday in 14d", timeline shows invented "Payday · Aug 16 +$4,000.00" (real nextPay Sep 1).
- 05-fortnightly-settings-no-chip.png — Settings with no pay-cycle chip active, the only visible symptom.
