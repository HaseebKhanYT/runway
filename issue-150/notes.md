# Issue #150 — desktop runway rail labels overlap

Captured 2026-08-05 on a local dev stack (Next.js web :3000 + Hono API :8787 +
Postgres demo database), signed in as the `+clerk_test` smoke account, Chrome at
1440x900. Before is `develop` @ `ae8a7fe`; after is that tree plus the fix on
`fix/runway-rail-grows-with-its-nodes`.

## Account state

`POST /reset-demo`, then 17 further monthly survival bills added through
`POST /bills` (Electric, Gas, Water, Internet, Phone, Car payment, Car
insurance, Renters insurance, Netflix, Spotify, iCloud, Gym, Patreon, NYT,
Dropbox, Audible, Hulu) on due days 6–27 — the subscription-heavy month the
issue describes. 23 unpaid bills, payday 14 days out.

## Measurement

Every label box on the rail read with `getBoundingClientRect`, grouped by which
side of the rail it sits on, then each adjacent same-side pair compared. Two
labels overlap when the next box's left edge is left of the previous box's right
edge.

| | before | after |
| --- | --- | --- |
| overlapping label pairs | 21 | 0 |
| worst overlap | 36.7px | none |
| smallest same-side gutter | −36.7px | 14.6px |
| rail width | 1094px | 1915px |
| rail scroller engages | no (`scrollWidth === clientWidth`) | yes (822px of travel) |
| page scrolls sideways | no | no (`documentElement.scrollWidth` 1440) |

## Screenshots

- `01-before-labels-overlap.png` — names print over each other: "Car paymenCar
  insurance insurance", and the amounts run together as
  "$3.00 · Aug 20$8.00 · Aug 2$12.00 · Aug 2$18.00 · Aug 27".
- `02-after-rail-grows.png` — same account, same viewport. Every label legible;
  the rail extends past the panel and scrolls inside its own container.
