# Issue #24 — A 12-month promo is stored as 360 days, and every card edit extends it

## Verdict

reproduced — 12 months stored as today+360 (five days short of the calendar
year), and a nickname-only edit moved `promoEnd` from today+140 to today+150.

## Steps executed

1. Reset demo, wiped to minimal. Today inside the app is 2026-08-02.
2. UI, Cards: added "Card Q" — APR 24.99, limit 10000, balance 500, promo on,
   promo APR 0, **12** months left. Stored `promoEnd`: **2027-07-28**
   (= today + 360 days; twelve calendar months would be 2027-08-02).
   `state-after-create.json`; screenshot 01 shows the tag "0% until Jul ·
   then 24.99%" — July, not August.
3. SQL (this user's row only): set `promoEnd = '2026-12-20 00:00:00'`
   (today+140, "roughly 140 days remain"). Reload confirms
   `promoEnd: "2026-12-20"` (`state-before-edit.json`).
4. UI: clicked **Edit** on Card Q. The form prefilled the promo months field
   with **5** (`Math.round(140/30)`) — screenshot 02. Changed only the
   nickname ("Card Q" → "Card Q renamed") and clicked **Save changes**.
5. New `promoEnd`: **2026-12-30** = today+150 (`state-after-edit.json`).
6. Visible variant: SQL set `promoEnd = '2026-09-18 00:00:00'` (today+47 →
   tag "0% until Sep", screenshot 03). Nickname-only edit again →
   `promoEnd` became **2026-10-01** (today+60; 47 days rounds to 2 months =
   60 days) → tag now "0% until Oct · then 24.99%", status line "0% ends Oct
   2026 (2 mo)" — screenshot 04. `state-variant-after-edit.json`.

## Observed vs expected

Observed: creating a 12-month promo stores `promoEnd = 2027-07-28` (today +
12×30 = 360 days, `promoEndFromMonths` in `apps/api/src/routes/cards.ts:12-17`);
expected 2027-08-02, twelve calendar months out — the promo expires 5 days
early. Observed: with 140 days remaining, saving the edit form after changing
only the nickname moved `promoEnd` 2026-12-20 → 2026-12-30; expected: an edit
that does not touch promo fields leaves `promoEnd` unchanged. The gain is
exactly the predicted `round(140/30)×30 − 140 = +10` days, because the form
always resends a months value derived from remaining days and the PATCH always
recomputes the end date from now. The 47-day variant shows the same ratchet
moving the promo across a month boundary on screen (Sep → Oct, +13 days) from
a pure rename.

## Screenshots

- 01-12mo-promo-stored-as-360-days.png — freshly created 12-month promo: tag "0% until Jul · then 24.99%" (should be Aug 2027).
- 02-edit-form-prefills-5-months-from-140-days.png — edit form with promo months prefilled to "5" while 140 days remain; only the nickname is about to change.
- 03-promo-until-sep-before-nickname-edit.png — before the rename-only edit: "0% until Sep", "0% ends Sep 2026".
- 04-promo-until-oct-after-nickname-edit.png — after the rename-only edit: "0% until Oct · then 24.99%", "0% ends Oct 2026 (2 mo)" — the promo gained 13 days.
