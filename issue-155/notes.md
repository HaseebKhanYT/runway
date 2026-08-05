# Issue #155 — the payday modal's primary button does nothing at a zero paycheck

Captured on 2026-08-05 against `develop` @ ff03951 (before) and
`fix/payday-modal-no-paycheck-on-record` @ e7c55ee (after), on a local dev
stack (Next.js web on :3000, Hono API on :8787, Postgres demo database),
signed in as the `+clerk_test` smoke account, on `/runway` at 1200×687.

The state is the demo fixture with one field changed:
`PATCH /profile {"payAmount": 0}` answers 200, which is the whole point —
`profilePatchSchema.payAmount` is `money.nonnegative()`, so a zero paycheck is
a storable fact rather than a corruption.

## Screenshots

| File                            | What it shows                                                            |
| ------------------------------- | ------------------------------------------------------------------------ |
| `01-before-dead-primary.png`    | Before. A full-width accent primary reading "Yes — $0.00 landed".        |
| `02-after-live-primary.png`     | After. The same state: the primary reads "Enter what landed".            |
| `03-after-entry-path-empty.png` | After, one click on. The field is empty and autofocused, Confirm greyed. |

The dark circle at the bottom left of every shot is the Next.js dev-tools
badge, which exists only under `next dev`. It is not part of the application.

## Measurements

Read out of the page with `document.querySelectorAll('button')` and the
Playwright network log.

### Before

| Control                  | `disabled` | Clicks | Requests to `/payday/confirm` |
| ------------------------ | ---------- | ------ | ----------------------------- |
| "Yes — $0.00 landed"     | `false`    | 2      | **0**                         |

The modal stayed open, printed no error, and the page issued nothing but the
`GET /me/state` it had already made on load. `run` returns on `amount <= 0`
before it reaches `mutate`, and the button mirrored only the `isPending` half
of that guard.

### After

Same state, `payAmount` 0:

| Control                  | `disabled` | Result                                            |
| ------------------------ | ---------- | ------------------------------------------------- |
| "Enter what landed"      | `false`    | opens the entry path                              |
| amount field             | —          | value `""`, `document.activeElement === input`    |
| "Confirm" (empty field)  | `true`     | —                                                 |
| "Confirm" (typed `1450`) | `false`    | `POST /payday/confirm => 200`, modal closes       |

No control reads "$0.00 landed"; "A different amount…" is correctly absent,
since the primary is now that path; "Not yet — ask me later" is still present.
The confirmed payday advanced `nextPay` from 2026-08-19 to 2026-09-02, one
biweekly cycle.

### After, regression check at `payAmount` 1700

The three buttons render with the same copy in the same order as before —
"Yes — $1,700.00 landed", "A different amount…", "Not yet — ask me later" —
"Enter what landed" is absent, the secondary still prefills the field with
`1700` under the original "fewer shifts, overtime" hint, and the stored-amount
primary still answers `POST /payday/confirm => 200` and closes the modal.

## Noted in passing, not fixed here

After confirming an entered amount, `profile.payAmount` is still 0 and no
income transaction exists — the paycheck actually received is never written
back. That is #77, which predates this change and is untouched by it. Its
visible consequence now is that the next cycle offers "Enter what landed"
again rather than a remembered figure.

The runway rail's node keeps the accessible name "Confirm payday, +$0.00 on
Aug 19" at a zero paycheck, which reads oddly for the same reason the button
did. It is a different surface and is left alone.
