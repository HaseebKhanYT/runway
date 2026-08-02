# Issue #33 — Goal progress bar and card usage bar divide by user-controllable zero

## Verdict

`not reproducible` — every user-reachable write path rejects or clamps the
zero denominator (all verified live), and even with a zero forced into the DB
no `NaN` reaches the DOM: React silently drops the invalid width and the bar
renders empty.

## Steps executed

1. Reset demo (`POST /reset-demo`).
2. The issue's stated path — `PATCH /goals/:id` with `{target: 0}` on
   Emergency fund — returned **400** with Zod `too_small` on `target`
   ("Number must be greater than 0"). The issue's premise that
   `goalPatchSchema` leaves `target` unguarded is out of date:
   `packages/shared/src/schemas.ts:66` has `target: money.positive()`
   (optional, but positive when present). Response saved in
   `patch-target-0-response.json`.
3. UI edit path: Goals → Emergency fund → Edit → typed `0` into TARGET →
   Save changes. The client clamps it (`parseFloat(raw) || goal.target`,
   goals/page.tsx:61) — `/me/state` still shows `target: 1000`.
4. Card paths: `POST /cards {limit: 0}` → **400** (`limit` too_small);
   `PATCH /cards/:id {limit: 0}` → **400** (patch route uses
   `cardUpsertSchema.partial()`, so `limit` stays positive-only).
5. Since nothing user-controllable reaches the division, forced the zero via
   psql (this user's rows only): Emergency fund `target = 0` (saved stays
   400), Card B `limit = 0, balance = 0`.
6. Reloaded Goals and Cards with a console listener attached; inspected the
   progress-fill elements.

## Observed vs expected

The issue expects a `NaN%` width in a style attribute. Observed with the
DB-seeded zero: `goalBarSplit` does compute `finPct = min(100, (0/0)*100) =
NaN` and `payPct = NaN` (0/0 with `Math.min(100, NaN) = NaN`, exactly as the
issue derives), but React discards the invalid `width: NaN%` declaration
before it reaches the DOM — the fill divs' inline style contains only
`background` (no width at all, see `progressfill-widths.json`), computed
width is `0px`, and zero NaN warnings appeared on the console. What the user
actually sees is graceful-degradation-by-accident: an empty bar with a
nonsense readout "$400.00 / $0.00" and status "Fully funded — enjoy it"
(saved ≥ target is trivially true against 0), and Card B showing "balance
$0.00 of $0.00" with an empty usage bar. So the missing zero guard in
`goalBarSplit` (packages/shared/src/goals.ts:55-61) is a real latent gap in
the pure math, but as filed — user-controllable zero, NaN in the DOM — the
bug does not reproduce: the create path, patch path, UI edit, and both card
paths are all guarded today, and the render layer swallows the NaN.

## Screenshots

- 01-goal-400-of-0-target.png — Emergency fund "$400.00 / $0.00", empty progress bar, "Fully funded — enjoy it" (DB-seeded zero).
- 02-card-usage-0-of-0.png — Card B "balance $0.00 of $0.00", empty usage bar, "Paid off — $0.00 available".

API evidence: `patch-target-0-response.json` (400 on the issue's stated
path), `progressfill-widths.json` (no width declaration in the DOM,
computed 0px), `console-nan-warnings.txt` (empty — no React NaN warning).
