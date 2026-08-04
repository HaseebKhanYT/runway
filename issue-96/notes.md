# Issue #96 — the floating add button covers the last mobile nav item

Captured on 2026-08-04 against `develop` @ eb2a29c (before) and
`fix/fab-clear-of-the-mobile-nav` @ d239045 (after), on a local dev stack
(Next.js web on :3000, Hono API on :8787, Postgres demo database), signed in as
the `+clerk_test` smoke account, on `/runway`.

## Screenshots

| File                                   | What it shows                                                  |
| -------------------------------------- | -------------------------------------------------------------- |
| `01-before-360-settings-covered.png`   | 360×640. Five nav icons visible; the sixth (Settings) is under the button. |
| `02-after-360-button-lifted.png`       | 360×640. All six icons visible; the button sits above the pill. |

The dark circle at the bottom left of both shots is the Next.js dev-tools
badge, which exists only under `next dev`. It is not part of the application.

## Measurements

Taken with `getBoundingClientRect` and `document.elementFromPoint` in the page.

### Before

| width | variant         | nav width | nav box       | button box    | last item covered | `elementFromPoint` at Settings' centre |
| ----- | --------------- | --------- | ------------- | ------------- | ----------------- | -------------------------------------- |
| 320   | phoneNav + fab  | 314px     | x 3 → 317     | x 248 → 302   | 87% (Cards 22%)   | Add expense                            |
| 360   | phoneNav + fab  | 314px     | x 23 → 337    | x 288 → 342   | 87%               | Add expense                            |
| 620   | padNav + fabPad | 591px     | x 14 → 606    | x 546 → 602   | 49%               | (centre clear, right half covered)     |
| 780   | padNav + fabPad | 591px     | x 94 → 686    | x 706 → 762   | 0%                | Settings                               |

The two boxes intersect whenever `W/2 + navW/2 > W − (18 + fabW)`. With the
measured widths that is `W < ~458` for the icon-only nav — every phone — and
`W < ~739` for the labelled nav. Only 739–780px was ever clear.

### After

At 320, 360, 430, 620, 700 and 780px: the boxes have zero intersecting area,
the vertical gap is 12px, the button keeps its 18px right inset, the nav keeps
its 14px bottom inset and stays centred, and `elementFromPoint` at the centre
of every one of the six items resolves inside that item.

At 360px, clicking Settings navigates to `/settings` and clicking the button
opens the add-expense modal (z-index 50, above the bar's 40). Probe points
inside the wrapper's 360×122 box but outside both children resolve to page
content, so the strip does not block taps. Scrolled to the bottom at 780px the
last content row clears the stack by 12px. At 1280px neither the bar nor the
nav renders and the sidebar is unchanged.

## Not reproduced

The issue's closing note claims the runway panel grid gives the page a
horizontal scrollbar at 320px. It does not. The track computes to 290px inside
a 288px content box — 2px of internal overflow — but
`documentElement.scrollWidth === clientWidth === 320`, `html`/`body` are
`overflow-x: visible`, and the first panel's right edge is 306px. Nothing is
clipped and no scrollbar appears.
