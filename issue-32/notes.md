# Issue #32 — Planner writes local-midnight dates that serialize back one day early

## Verdict

`reproduced` — the local-time write / UTC read mismatch is real and shifts the
financing bill's serialized date by one day whenever the lock-in happens after
17:00 local (America/Los_Angeles); the goal-`due` half of the claim cannot
occur in this server timezone (details below).

## Steps executed

1. Reset demo (`POST /reset-demo`). Today inside the app: Sunday, Aug 2, 2026.
   Server TZ: `America/Los_Angeles` (PDT, UTC−7) — matching the issue's step 1.
2. UI, Goals page: planner → "a necessity", name "Visa fees", target $15,000,
   months stepper ×3 (label read **November 2026**), levers "Put the rest on
   Card A" + "Earn the rest" → "Covered ✓" → **Lock this plan in**. Lock-in
   wall clock: Sun Aug 02 2026 **08:26:04** PDT.
3. Read `GET /me/state` (control, `state-control.json`): goal `due`
   `2026-11-01`, `note` "Nov 2026"; bill "Visa fees financing" `dueDate`
   `2026-08-12`, `off` 10. All correct — because the lock-in was in the
   morning.
4. Raw rows via psql (write-path evidence): the stored financing-bill
   `dueDate` is `2026-08-12 15:26:04.987` — the lock-in's **wall-clock time
   of day leaked into a due date** (start-plan.ts:31-32 copies `new Date()`
   and only shifts the day). Goal `due` stored `2026-11-01 07:00:00` (local
   midnight + 7 h).
5. Computed the exact value start-plan.ts:31-32 produces at an **evening**
   lock-in, with `TZ=America/Los_Angeles node`:
   `today = 2026-08-02T19:30:00-07:00` → `finDue.setDate(+10)` →
   `2026-08-13T02:30:00.000Z`. (Deterministic — same expression, later clock.)
6. Installed that value on the just-created row (this user only):
   `UPDATE "Bill" SET "dueDate" = '2026-08-13 02:30:00' WHERE "userId" = 'user_3HAsUFEqcSzztjGdDc21TDwYBIe' AND name = 'Visa fees financing'`
7. Re-read `/me/state` and re-screenshotted Bills + Runway. Reset demo after.

## Observed vs expected

Expected: a plan locked in at any hour puts its financing bill 10 days out —
here Aug 2 + 10 = **Aug 12** (`off` 10), which is what the serializer should
return regardless of lock-in time. Observed: the identical plan evaluated at a
19:30 PDT lock-in stores `2026-08-13T02:30Z`, and the UTC-getter serializer
(app-state.ts:47-52) returns `dueDate` **2026-08-13**, `off` **11** — the
Bills list and the runway timeline node land on Aug 13, one day off, purely
because of the time of day the button was clicked. Direction note: in a
UTC-negative zone the shift is one day **late**; the issue title's "one day
early" and the goal-`due` regressing to "last day of the preceding month"
require a UTC-positive server zone — `new Date(y, m, 1)` at local midnight in
Los Angeles is 07:00Z the _same_ day, so the goal half serialized correctly
here (`due` 2026-11-01 / `note` "Nov 2026" agree, control and after) and is
not reproducible with this server's clock without restarting the API in a
different TZ (forbidden by the playbook). The mechanism the issue pins
(local-time construction in start-plan.ts vs UTC read-back in
app-state.ts) is confirmed by the raw row in step 4 either way.

## Screenshots

- 01-planner-promises-november-2026.png — planner card, necessity 3 months out, month label "November 2026", Covered ✓ with Card A financing.
- 02-live-morning-lockin-bill-on-aug-12.png — control: "Visa fees financing due Aug 12" (correct, morning lock-in).
- 03-evening-lockin-bill-shifted-to-aug-13.png — same plan with the evening lock-in value: "due Aug 13", one day off today+10.
- 04-runway-timeline-node-aug-13.png — runway timeline node for the financing bill sitting on Aug 13.

API evidence: `state-control.json` (correct morning serialization),
`state-after-evening-value.json` (dueDate 2026-08-13, off 11).
