# Issue #92 — the hero day figure has no separators, no guard, no overflow rule

## Verdict

`reproduced in part`. The two formatter defects reproduce exactly as reported.
The overflow claim is real but not at the magnitude the issue states: a
four-figure figure at 360px fits with 90px to spare, and the page gains a
horizontal scrollbar only past eight digits.

## Steps executed

Against `develop` (`94b03c8`) served from a local dev stack, signed in as the
smoke user, Chrome via Playwright.

1. Set the profile to a high earner so the hero reaches four figures —
   `payAmount` 20000, `primaryBalance` 30000. The runway math gives
   `sustainablePerDay = 1376`, and `effectivePerDay = min(thisCycle,
   sustainable)` makes that the number on screen.
2. Read the hero at 390px. **`$1376/day`**, with the balance chip immediately
   above reading **`$30,000.00`** and the payday node below reading
   **`+$20,000.00`** — the same viewport, the same kind of quantity, two
   conventions (01).
3. Intercepted `GET /me/state` and deleted `profile.primaryBalance` from the
   response body, standing in for a wire-shape skew between the Vercel web
   build and the Railway API. The hero rendered **`$NaN/day`** at 42px, and the
   balance chip and Today node rendered `$NaN` (02).
4. Measured the hero's real geometry at 320px and 360px with a canvas
   `measureText` at the computed font (`bold 42px Instrument Sans`,
   `letter-spacing: -1.5px`), rather than trusting the issue's estimate.

## Observed vs expected

**Grouping — as reported.** `formatDayAmount` concatenates `Math.abs(n)`, so it
emits no separator, while `formatMoney` two lines above emits `$1,376.00`.

**Non-finite — as reported.** `NaN < 0` is false, so NaN takes the `'$'` branch
and concatenates to `"$NaN"`. Reachable because `useApiFetch` ends at
`res.json() as Promise<T>` with no runtime validation; inbound money is
`z.number().finite()`, so the database cannot be the source.

**Overflow — overstated.** Digits advance ~21px at 42px with the negative
tracking, not ~42px, so roughly 13 characters fit in a 280px box:

| Viewport | Hero content box | `$1376/day` | Spills the card | Scrolls the page |
| -------- | ---------------- | ----------- | --------------- | ---------------- |
| 360px    | 280px            | 189px       | ~9 digits       | ~11 digits       |
| 320px    | 240px            | 189px       | `$137600/day`   | `$13760000/day`  |

Still reachable: `money` carries no upper bound, so a slipped decimal in
Settings (pay amount `20000000`) yields `$1,428,519/day`. On `develop` that
takes `document.scrollWidth` to 334 against a 320px viewport — a horizontal
scrollbar on the whole page.

The sidebar `SAFE / DAY` tile was checked and is not affected: a 167px box at
26px type, where `$1,376,000` measures 132px.

## After the fix (`fix/day-figure-at-extremes`)

Same three states, same stack, rebuilt from the fix branch:

- `$1,376/day`, and the squeezed sub-line `$2,041/day` (03).
- The stripped-field response renders `$—/day`, with the balance chip and Today
  node showing `$—` and no `NaN` anywhere on the page (04).
- `$1,428,519/day` at 320px wraps to two lines inside the card;
  `document.scrollWidth` is 320 (05). Toggling `overflow-wrap` back to `normal`
  in the same DOM returns it to 334, which isolates the CSS rule as the cause.

`/bills`, `/goals`, `/activity`, `/cards` and `/settings` were swept for stray
`$—` placeholders under normal demo data and found none.

## Screenshots

- 01-before-ungrouped-hero.png — develop: `$1376/day` above `$30,000.00`.
- 02-before-nan-hero.png — develop, `primaryBalance` stripped: `$NaN/day`.
- 03-after-grouped-hero.png — fix branch: `$1,376/day`.
- 04-after-placeholder-hero.png — fix branch, same stripped response: `$—/day`.
- 05-after-wraps-at-320.png — fix branch at 320px: `$1,428,519/day` wraps
  inside the card, no horizontal scrollbar.
