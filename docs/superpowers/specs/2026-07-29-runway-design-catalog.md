# Runway — Design v1 Implementation Catalog

Companion to [2026-07-29-runway-app-design.md](./2026-07-29-runway-app-design.md).
Produced by exhaustive analysis of `design-v1/`. This is the fidelity reference
for implementation: exact copy strings, hex values, formulas, and interactions.

**Files analyzed** (all under `design-v1/`):

| File | Role |
|---|---|
| `Runway Budget.dc.html` (3,317 lines) | **The hi-fi app.** Lines 29–1174 = markup; lines 1176–3314 = a complete logic class with all state, formulas and handlers. Source of truth. |
| `Budget Planner Wireframes.dc.html` (1,692 lines) | Design-history doc, 8 "turns" (t1…t8), reverse-chronological. Lo-fi. |
| `Activity Row Options.dc.html` (471 lines) | 8 activity-row variants. |
| `support.js` | Design-canvas runtime (React-based). |
| `screenshots/` (6 PNGs) | Renders of an earlier hi-fi state (see §5.3). |
| `assets/banks/` | `chase.png`, `bank-of-america.png` — account logo options. |

---

## 0. Runtime / templating semantics (`support.js`)

Needed only to read the HTML correctly — do not port it.

- `<x-dc>` wraps the markup; a script block holds the logic class (React
  `Component`-like: `setState`, `componentDidMount`, `props`, `render`).
- `{{ expr }}` inside any attribute or text resolves against `renderVals()`.
  Works inside `style="…"` too — conditional styling injects whole style strings.
- `<sc-if value="{{ cond }}">` — conditional. `hint-placeholder-val` is only a
  streaming-preview hint, but reveals the designer's intended default state
  (e.g. `viewRunway` hint `true`, `crunchOn` hint `false`).
- `<sc-for list="{{ items }}" as="x" hint-placeholder-count="N">` — N is a
  preview row count ("expected list length"), not data.
- `style-hover="…"`, `style-active="…"` — pseudo-state style overlays.
- `onClick`/`onChange`/`onKeyDown`/`onDragStart`/`onTouchMove`… → handlers.

**Configurable props** (`data-props`, line 1176):

| Prop | Editor | Default | Options |
|---|---|---|---|
| `accent` | color | `#2E8C5A` | `#D9772E`, `#8B6FD8`, `#2E8C5A` |
| `safeView` | enum | `per-day` | `per-day`, `total` |
| `showCents` | boolean | `true` | — |
| `activityIcon` | enum | `tile` | `tile`, `ring`, `solid`, `bare` |

Note: code fallbacks differ from prop defaults — `renderVals()` uses
`props.accent ?? '#D9772E'` (line 2103) and `fm()` uses
`props.showCents ?? false` (line 1402). **Implementation uses the prop
defaults: accent `#2E8C5A`, showCents `true`.**

---

## 1. Screen inventory

### Global shell — `data-screen-label="Runway Budget App"` (line 29)

`min-height:100vh; display:flex; background:#f6f0e6`.

**Responsive rules** (`componentDidMount`, lines 1372–1377):
- `mq = matchMedia('(max-width: 780px)')` → `isMobile`
- `mqT = matchMedia('(min-width: 620px)')` → `wideMobile`
- **Desktop ≥781px**: left sidebar, no bottom nav.
- **Tablet 620–780px**: `padNav` — floating glass pill with icon + label, plus a 56px circular `+`.
- **Phone <620px**: `phoneNav` — glass pill, icons only, plus a 54px FAB.

**Sidebar (desktop)** — `width:230px; flex:none; border-right:1px solid #e7dcc8; padding:24px 16px; gap:6px; position:sticky; top:0; height:100vh`:
1. Brand: 26px circle, `border:2.5px solid #29221a`, inner 12×2.5px bar rotated −35deg (the "runway/horizon" mark). Wordmark **"Runway"** 18px/700/ls −.3px.
2. `navItems` (6): **Runway, Bills, Goals, Activity, Cards, Settings**. Row: `padding:10px 12px; border-radius:11px; font-size:14.5px; font-weight:600`. Active = `color:#f6f0e6; background:#29221a`; inactive = `#29221a` on transparent, hover `background:#ede3d0`. Right badge 11.5px/600 `#8d8070` — only Bills gets one (unpaid count).
3. **"+ Add expense"** button — `margin-top:14px; padding:12px; border-radius:12px; background:{accent}; color:#fff; font-weight:650; 14.5px; text-align:center`, hover `filter:brightness(1.07)`.
4. Bottom card (`margin-top:auto`): `padding:16px 14px; border:1px solid #e7dcc8; border-radius:14px; background:#fffcf6`
   - `SAFE / DAY` — 11px/600/ls .8px `#8d8070`
   - `{perDayF}` — 26px/700/ls −.5px/lh 1, tabular-nums, color `{perDayColor}`
   - `{perDaySub}` — 11.5px/lh 1.35 `#8d8070`

**Main column**: `flex:1; min-width:0; padding:clamp(16px,3vw,32px); padding-bottom:110px; max-width:1180px`.

**Page header** (all views): title `{pageTitle}` at `clamp(22px,3vw,28px)/700/ls −.4px`; subtitle 13px `#8d8070` (`"Thursday, July 16"` — `toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})`). Right side, two pills (`padding:8px 14px; border:1px solid #e7dcc8; border-radius:999px; background:#fffcf6; 13px/600`):
- `balance {balanceF}` + `{acctChipTag}` — clickable, `title="Manage accounts"`, opens Accounts modal. Hover `border-color:#29221a; background:#f6efe1`. `acctChipTag` = `"▾"` when no extra accounts, else `"· N"` (total account count).
- `payday in {daysToPay}d` — static, `color:#8d8070`.

Page titles: `{runway:'Your runway', bills:'Bills to pay', goals:'Big things', activity:'All activity', cards:'Credit cards', settings:'Settings'}`.

**Bottom nav icons** are pure CSS (`navIcons`, lines 2147–2154):
```
runway   : 18×2.5px bar, radius 2, rotate(-32deg)
bills    : 12×7px checkmark from border-left+border-bottom 2.5px, rotate(-45deg)
goals    : 14×14px circle, 2.5px border
activity : 15×11px, border-top + border-bottom 2.5px
cards    : 17×12px rounded rect 3.5px + linear-gradient magstripe band 2–4px
settings : 15×15px circle 2.5px border + radial-gradient dot core
```

---

### 1.1 `Dashboard — Runway` (line 68) — desktop and mobile

Vertical stack, `gap:16px`. Shown when `view === 'runway'`.

**A. Hero** (when `!crunchOn`) — line 108:
`background:#29221a; color:#f6f0e6; border-radius:20px; padding:22px 24px`
- `{heroLabel}` — 11.5px/600/ls 1px `#b8a98f`: `"YOURS TO SPEND, EVERY DAY"` (per-day) or `"SAFE TO SPEND"` (total).
- `{heroNumber}` — `clamp(42px,6vw,58px)/700/ls −1.5px/lh 1.05` tabular-nums, color `{heroColor}`: `"$17/day"` style (`dayF(effDay) + '/day'`) or `fm(safe)`.
  - `heroColor` = `#e58c5b` when `safe < 0 || overCommitted`, else `#f6f0e6`.
- `{heroSub}` — 13.5px `#b8a98f`. Five exact strings:
  - `safe < 0` → `"bills due before payday exceed your balance — let's look at the runway"`
  - total mode → `"until payday · " + d(DAYS)` e.g. `"until payday · Jul 30"`
  - `overCommitted` → `"your goals + bills need $X more than each paycheck brings in — stretch a goal timeline"`
  - `squeezed` → `"a pace that still works after payday — this cycle alone would allow $34/day"`
  - else → `"after bills & goals"`

**B. Horizontal runway (desktop only)** — line 116:
Wrapper `background:#fffcf6; border:1px solid #e7dcc8; border-radius:20px; padding:10px; overflow-x:auto`. Inner `position:relative; height:224px; min-width:920px`.
- **Rail**: `position:absolute; left:2.5%; right:2.5%; top:50%; height:2px; background:#e0d3bb; border-radius:2px`.
- **Today node** at `left:3%`: 16px solid `#29221a` circle; label `"Today"` 12px/650 + `{balanceF}` 11.5px `#8d8070` tabular.
- **Bill nodes** (`runNodes`): absolutely positioned at `left:{pct}%`, alternating above (`flex-direction:column; bottom:calc(50% - 11px)`) / below (`column-reverse; top:calc(50% - 11px)`). Label block `width:100px; text-align:center`: name 12.5px/650 (line-through + `#a89b88` when paid), then `{amountF} · {due}` 11.5px `#8d8070` (e.g. `"$950.00 · Jul 18"`). Dot: 22px circle, `2px solid #29221a`; unpaid `background:#fffcf6`, paid `background:#29221a; color:#fff` with `✓`. `title="mark paid / unpaid"`, hover `transform:scale(1.18)`, click → `promptPayBill(id, fromRunway=true)`.
- **Payday node** at `left:{paydayLeft}%`: 22px circle, `border:3px solid {accent}; background:#fffcf6; animation:pulse 2.4s infinite; cursor:pointer`, `title="It landed? Tap to confirm"` → Payday confirm. Three-line label (`width:110px`):
  - `Payday · {paydayLabel}` — 12px/650, accent → e.g. **`Payday · Jul 30`**
  - `+{payAmountF}` — 11.5px `#8d8070` tabular → **`+$600.00`**
  - `−{setAsideF} → goals` — 11px/600 `#8b6fd8` tabular → **`−$142.00 → goals`**

**C. Vertical runway (mobile only)** — line 145:
`background:#fffcf6; border:1px solid #e7dcc8; border-radius:20px; padding:18px`.
- Header row: 14px dot `#29221a`, `Today · {todayShort}` 13px/650, right `{balanceF}` 13px/650 tabular.
- Spine: `border-left:2px solid #e0d3bb; margin-left:9px; padding:4px 0 4px 16px`.
- `runSeq` — one merged, date-ordered sequence of bills and payday. Row spacing proportional to day-gaps: `marginTop = clamp(gapDays × 7px, 16px, 82px)`.
  - Bill row: 24px dot (`margin-left:-29px`), name 14px/600, sub `due {d(off)}` 11.5px `#8d8070`, amount `−$X` 14px/600 tabular. Paid → strikethrough + `#a89b88`.
  - Payday row: 18px dot `3px solid {accent}`, `margin-left:-26px`; name `Payday · Jul 30` 13px/650 accent; amount `+$1,700.00` accent.
  - Goals row (always follows payday, `margin-top:9px`): 10px solid `#8b6fd8` dot `margin-left:-22px`; text **`then set aside for goals`** 12.5px `#8d8070`; amount `−{setAside}` 12.5px/650 `#8b6fd8`.

**D. Two-up grid** `grid-template-columns:repeat(auto-fit,minmax(290px,1fr)); gap:16px`. Panels: `background:#fffcf6; border:1px solid #e7dcc8; border-radius:20px; padding:20px`.

*Spending categories* (line 169):
- Header: **"Spending categories"** 13px/700/ls .3px; right **`{manageLabel}`** = `"Edit"` / `"Done"`, 12px/650, accent, toggles `catManage`.
- Rows, gap 13px. Row 1: 10px color dot, name 13.5px/600, then either
  - manage mode: `Edit` (11.5px/650 `#8d8070`) and `✕` (14px `#c2410c`, hidden for locked `unc`), or
  - normal: `{amountLabel}` — `"$182.40 / $300.00"` when budgeted, `"$0.00 spent"` when `budget === 0`. Color `#8d8070`, or `#c2410c` when over.
- Row 2: bar `height:8px; border-radius:5px; background:{trackColor}` (`#efe6d4`, `#f3d9cc` when over) with fill `width:{pct}%; background:{c.color}; transition:width .35s`.
- Footer: **`+ Add category`** — dashed `1.5px #d9cbb0`, `border-radius:11px; padding:9px; 12.5px/650 #8d8070`, hover `border-color:#29221a; color:#29221a`.

*Recent activity* (line 196):
- Header **"Recent activity"** 13px/700; right **`View all →`** 12px/650 accent → `go('activity')`.
- `txns.slice(0, 7)`. Row (`border-bottom:1px solid #f0e7d6`, `padding:9px 0`, cursor pointer): icon tile, label 14px/600, meta `{when} · {srcVia}` 11.5px `#8d8070` truncated, amount 14px/650 tabular (`#2e7d4f` if positive, else `#29221a`), chevron `›` 17px `#c3b6a1` rotating 0→90deg on expand.
- Expanded panel: shared spec (§1.13).

---

### 1.2 `Cash crunch` (line 72) — replaces hero when `crunchOn` (`safe < 0`)

`background:#29221a; color:#f6f0e6; border:2px solid #c2410c; border-radius:20px; padding:22px 24px`.
- Eyebrow: **`CASH CRUNCH · CAUGHT EARLY`** — 11.5px/600/ls 1px `#e58b6b`.
- Number: `{crunchShortF} short` — `clamp(36px,5vw,48px)/700/ls −1.2px` `#e58b6b`.
- Sub: `{crunchBillLine} — there's still time to fix it.` 13.5px `#b8a98f`.
  - `crunchBillLine` = `"Not enough for Rent ($950.00, due Jul 18)"` — first bill (earliest `off`) where running balance goes negative — or `"Your set-asides put you under for this cycle"`.
- **`FIND THE MONEY — CHEAPEST FIRST`** — 11px/700/ls .8px `#b8a98f`. Levers in fixed order:
  1. `crunchGoalLevers` — per pausable goal: *"Pause "Japan trip" this cycle"* / *"frees $85.00 · resumes automatically at payday"*.
  2. **Borrow from someone you trust · 0%** (always) — dashed `1.5px rgba(246,240,230,.35)`, 20px dashed `+` box; sub *"no interest — Runway tracks who and when you pay back"* → Personal loan modal, prefilled `ceil(crunchRem)`.
  3. `crunchCardLevers` — cards by effective APR ascending, only with headroom: *"Cover the rest with Card B · 0% promo"* (or `"· 21.9% APR"`) / *"≈$300.00 advanced · $0 interest if cleared before the promo ends"* or `"≈$5.00/mo interest until you clear it"`.
  4. **Log money in** (always) — dashed; sub *"a side gig or refund shrinks this instantly"* → Add-expense modal in income mode.
  - Lever style: `border:1.5px solid rgba(246,240,230,.28)` (selected `#f6f0e6`), radius 12, `padding:10px 12px`, background transparent → `rgba(246,240,230,.1)` selected. Checkbox 20px radius 7px; selected `background:#f6f0e6; color:#29221a` with `✓`.
- Footer: `{crunchGapLine}` 13px/650 color `{crunchGapColor}` (`#7fc79b` covered / `#e58b6b` short) + **`Lock this plan`** (`padding:11px 20px; radius 12`; enabled `background:#f6f0e6; color:#29221a`, disabled `rgba(246,240,230,.15)` / text `rgba(246,240,230,.5)`).
  - Covered: `"Covered ✓ · $85.00 from paused goals · $300.00 on Card B"`
  - Short: `"Still short $120.00 — stack another lever"` (or `"— log money in, or trim a bill"` if no levers).

---

### 1.3 `Bills checklist` (line 233) — `view === 'bills'`

- **Progress card**: **"This month"** 15px/700; right `{billsLeftF} left of {billsTotalF}` 13px `#8d8070`. Bar `height:10px; radius 6; background:#efe6d4`, fill `#29221a` at `{billsPaidPct}%`.
- **Three groups**, each a drop target:
  | title | note | add? |
  |---|---|---|
  | `SURVIVAL` | `{fm(survivalSum)} / month` | `+ Add survival bill`, placeholder `"Name — rent, water, insurance…"` |
  | `SUBSCRIPTIONS` | `{fm(subsSum)} / month` | `+ Add subscription`, placeholder `"Name — or tap a preset"`, preset chips + monthly/yearly toggle |
  | `DEBT` | `{fm(debtSum)} / month` | no add — cards own these |
  - Group header: title 11.5px/700/ls 1px `#8d8070`, note 11.5px `#8d8070`. Wrapper gets `background:#f3ead8; box-shadow:inset 0 0 0 2px #29221a` while a valid drag hovers.
  - Items grid: `repeat(auto-fill,minmax(min(320px,100%),1fr)); gap:8px; align-items:start`.
- **Bill row**: `background:#fffcf6; border:1px solid {rowBorder}` (`#e5b48a` flagged & unpaid, else `#e7dcc8`); `border-radius:14px; padding:13px 16px; gap:12px`.
  - 22px checkbox, `border-radius:7px`, `2px solid #29221a`; paid → `#29221a` fill + white `✓`; hover `scale(1.12)`. Click → `promptPayBill(id, false)`.
  - Name 14.5px/600 (strikethrough + `#a89b88` when paid) + optional tag pill (10.5px/600, `1px solid #e0d3bb`, radius 5, `padding:1px 6px`): `"0% · personal"` / `"autopay"` / `"yearly"`.
  - Meta 12px: `"paid ✓"` / flag text / `"due Jul 18"`; `#c2410c` when flagged & unpaid else `#8d8070`.
  - Amount 15px/650 tabular.
  - Desktop-only `✕` (22px circle, `#d8cbb0` → hover `#c2410c` on `#f7ebdd`).
  - **Mobile: swipe-left reveal** — action layer behind row: `Edit` (70px, `background:#5c5142; color:#f6f0e6`) and `Delete` (70px, `background:#c2410c; color:#fff`). Swipe distance 140px normal, 70px debt (no Edit). `onTouchStart/Move/End`; vertical intent >10px cancels, horizontal >8px engages; latches past half-width. `transform:translateX(tx)`, release `transform .28s cubic-bezier(.2,.8,.2,1)`.
  - **Desktop: drag to re-file** — `draggable` on non-debt rows; `opacity:.45` dragging; drop calls `moveBillKind`.
- **Inline add/edit form** (`grid-column:1/-1; background:#fffcf6; border:1.5px solid #29221a; radius:14; padding:16; gap:12; animation:fadeUp .18s ease-out`):
  - Subscriptions only: preset chips **Spotify $11.99 · iCloud+ $2.99 · YouTube Premium $13.99 · Disney+ $9.99 · Gym $35**.
  - Name input (flex 2) + `$` amount input (flex 1, `inputMode="decimal"`).
  - Row: `Due on the` [ `15` ] `of the month` + (subs only) `monthly | yearly` segmented control.
  - `PAY FROM` chips — only when `hasExtraAccts`; sources = Main checking + extra accounts + cards.
  - Buttons: `Add survival bill` / `Add subscription` / `Save …` (enabled `#29221a`/`#f6f0e6`, disabled `#e7dcc8`/`#a89b88`) + `Cancel`.
  - Enter saves, Escape cancels.

---

### 1.4 `Goals — big expenses` (line 302) — `view === 'goals'`

**Spare header card**: `background:#29221a; color:#f6f0e6; radius 20; padding:18px 20px`.
- `SPARE TO SAVE EACH MONTH` 11px/700/ls .8px `#c9bda8`
- `{spareMonthlyF}` 30px/700/ls −.5px + inline `left over after bills & goals` 12.5px `#c9bda8`
- `{spareProjLine}` 12.5px/lh 1.4 `#c9bda8`:
  - `"Set it aside and you could afford something worth $2,400 by May 2027."` (spare × 10 months)
  - or `"Your paycheck is fully committed right now — free up a little and you could start saving toward something big."` when spare < $10.

**Goal cards** in `repeat(auto-fit,minmax(min(320px,100%),1fr))`:
- Name 15px/700 + optional `non-negotiable` tag (10px/650, border `#e0d3bb`, radius 5). Right: `{savedF} / {targetF}` 13px `#8d8070`.
- **Two-segment progress bar** `height:10px; radius 6; background:#efe6d4; display:flex`: segment 1 `width:{finPct}%; background:#5c5142` (card-financed), segment 2 `width:{payPct}%; background:#8b6fd8` (paycheck set-asides).
- Legend (when financed > 0): `▪ {finF} fronted by {finFrom}` / `▪ {payF} set aside from paychecks`, 11.5px `#8d8070`, 8px radius-3 swatches.
- `{perMonthF}` 22px/700/ls −.5px + `{perMonthLabel}` 11.5px/650 `#8d8070` — `"a month keeps this on pace · by Apr 1"` or `"required each month · by Oct 1"` (necessity).
- `{remainingLine}` 11.5px `#8d8070` — `"$1,540.00 to go · $85.00 per paycheck × 18 left"` (per-paycheck clause dropped when cadence is monthly).
- `{status}` 12.5px/600, color `{statusColor}`:
  | status | color |
  |---|---|
  | `Fully funded — enjoy it` | `#2e7d4f` |
  | `⏸ Paused this cycle — resumes at payday` | `#8d8070` |
  | `⏸ Paused — feeding "Car repair"` | `#8d8070` |
  | `Non-negotiable — on plan` | `#5c5142` |
  | `⚠ A little behind` | `#c2410c` |
  | `On track` | `#2e7d4f` |
- `{perLine}` 12.5px `#5c5142` — `"Auto-adjusts as you save"`, `"Set aside automatically · your safety net"`, or `"$85.00/paycheck skips one cycle to cover the crunch · Apr 2027"`.
- Actions: **`+ Set aside now`** (pill, `1.5px solid #29221a`, radius 999, `padding:7px 15px`, hover inverts), spacer, **`Edit`**, **`Delete`** (12.5px/650 `#8d8070`; Delete hovers `#c2410c`).
- **Set-aside inline form**: optional `FROM` account chips; pill `$` input (`1.5px solid #29221a; radius 999`, placeholder = `min(25, remaining)`), **`Set aside`**, 30px `✕` circle (`background:#f1e8d8`).
- **Edit inline form**: `Name`, then `Target` + `Per paycheck` side by side, then `Save changes` + `Cancel`.

**Planner card** — `background:#fffcf6; border:1.5px dashed #d5c5a8; radius 20; padding 20`:
- **"Plan a big expense"** 15px/700; sub *"Add a goal and a target date — we'll work out the rest."*
- Segmented `a wish | a necessity` (`1.5px solid #e0d3bb`, radius 10; active `#29221a`/`#f6f0e6`).
- `{plKindHint}` 11.5px `#8d8070`: wish → *"flexible — adjust the date or amount whenever you like"*; necessity → *"date & amount are fixed — we find the money instead"*.
- Inputs: `"What is it? (new laptop, deposit…)"`; `"How much? ($)"` + month stepper `‹ By when? ›` (arrows 36px, hover `background:#f3ead9`; label e.g. `"October 2027"`, `#29221a` set / `#b3a48f` placeholder; range 1–600 months).
- `{plPerLine}` 13px/650, color `{plPerColor}` (`#8b6fd8` wish-ok, `#c2410c` over/short, `#2e7d4f` necessity-covered). Exact strings §3.6.
- **Levers** (necessity + short only) under `1px dashed #e0d3bb` divider, headed `FIND THE MONEY — CHEAPEST FIRST`: pause-a-wish rows, cards by effective APR, `Earn the rest`, plus `Add your cards to see credit options` (→ Cards) when no cards.
- `{plGapLine}` 12.5px/650: `"Covered ✓ · $85.00/pay freed from paused wishes · $1,200.00 on Card B"` / `"Still short $46.00 per paycheck — pick another lever"`.
- CTA `{startPlanLabel}` = `"Lock this plan in"` (necessity w/ gap) or `"Start this plan"`. Necessity `#29221a`/`#f6f0e6`, wish `#8b6fd8`/`#fff`, disabled `#e7dcc8`/`#a89b88`.

---

### 1.5 `Activity — all transactions` (line 411) — `view === 'activity'`

- **Three stat cards** (`flex:1; min-width:120px; #fffcf6; 1px #e7dcc8; radius 16; padding:14px 16px`): 11px/600/ls .8px `#8d8070` label, 22px/700 tabular number, 11.5px `#8d8070` footnote.
  - `MONEY IN` / `+{txInF}` `#2e7d4f` / `last 14 days`
  - `MONEY OUT` / `−{txOutF}` ink / `last 14 days`
  - `NET` / `{txNetF}` `#2e7d4f` (≥0) or `#c2410c` / `this period`
  - (Sums actually run over all txns — copy is aspirational.)
- **Filter chips** `All · Money in · Spending · Bills & subs · Goals` (`padding:7px 13px; radius 999; 12.5px/600`; active `#29221a`/`#f6f0e6`, idle `#fffcf6`/`#5c5142` `1.5px solid #e0d3bb`) + search `"Search activity…"` (`flex:1; min-width:150px; 1.5px solid #e0d3bb; radius 999; padding:8px 14px`).
- **Day-group cards** `repeat(auto-fill,minmax(min(340px,100%),1fr)); gap:16px`. Each header = `TODAY` / `YESTERDAY` / `JUL 14` (11.5px/700/ls 1px `#8d8070`) + day net `{netF}` 12px/650 (`#2e7d4f` positive else `#8d8070`). Rows = shared row + expand panel (§1.13); last row drops border.
- Empty state: `1.5px dashed #d8c9ab; radius 20; padding:28px; center; 13.5px #8d8070` — **"Nothing matches — try a different filter or search."**
- Pagination: **`View {txMoreCount} more · older activity`** (`1.5px solid #e0d3bb; radius 14; padding:13px`) and **`Collapse to recent`** (12.5px/650 `#8d8070`). Page size 12, +15 per tap.
- **Recently deleted** accordion (when non-empty): header `▸`/`▾` caret + **"Recently deleted"** 13.5px/700 + count badge (`background:#f1e8d8; radius 999; padding:2px 9px`). Body: *"Restore an entry to bring it back, or delete it for good."*, muted rows (`#a89b88`/`#5c5142`) each with **`Restore`** (12px/650 `#2e7d4f`, `1px solid #cbe0cf`, radius 9, hover `#e9f2ea`) and `✕` (`title="Delete forever"`). Footer **`Empty recently deleted`** 12.5px/650 `#c2410c`.

---

### 1.6 `Credit cards` (line 498) — `view === 'cards'`

Outer card. Header **"Credit cards"** 13px/700 + `{cardUsedTag}` (`"34% of limit used"`).

**Summary strip** (when `hasCards`):
- `TOTAL DEBT` — `#29221a`/`#f6f0e6`, radius 14, `padding:12px 14px`; 20px/700; footnote `across 2 cards` `#b8a98f`.
- `AVAILABLE` — outlined; 20px/700; footnote `of {cardLimitF} limit`.

**Card tiles** (sorted by balance desc): `1px solid #e7dcc8; radius 14; padding:14px 16px; gap:8px`.
- Name 14.5px/700 (ellipsis) + APR tag: `"17.9% APR"` (border `#e0d3bb`, `#8d8070`) or `"0% until Dec · then 21.9%"` (accent); + due tag when payment bill exists: `"$160.00 due Jul 21"` / `"$160.00 paid ✓"` (`background:#f1e8d8; color:#5c5142`).
- Right: `Edit` (12px/650 `#8d8070`), `✕` remove.
- **`USE FOR` reward pills** — 11.5px/650, radius 999, `padding:3px 9px`, bold tabular rate + category, colored by `catPill()` (§4).
- `balance` 12px `#8d8070`, `{balF}` 15px/650 + `of {limitF}` 11.5px/600.
- Utilization bar `height:8px; radius 5; background:#efe6d4`; fill `#29221a`, `#c2410c` at ≥80%.
- `{cd.line}` 12px/600 — five variants (§3.7).
- `Log payment` (full-width, `#29221a`/`#f6f0e6`, radius 10, `padding:9px`, hover `brightness(1.25)`) → inline `PAY FROM` chips + `$` input + `Log it` + `✕`, hint *"comes out of the source above — safe/day recalculates"*.
- Footer stamp: `updated today ✓` / `updated 34 days ago — statement out?`, 11px right; `#a89b88`, `#c2410c` + `⚠` at ≥30 days.

**Add / edit card form** (`grid-column:1/-1; 1.5px solid #29221a; radius 14; padding 16; gap 11`):
- Title `New card` / `Editing Card B`.
- Nickname — placeholder **`"Nickname — Card B, the blue one…"`**
- Row: `APR %` · `$ limit` · `$ balance`
- Row: `[21] due day of month` · `$ [payment / mo]` (disabled `background:#f1e8d8; opacity:.6; cursor:not-allowed`, placeholder `full balance`, when pay-in-full; `title="Turn off "Always pay in full" to set your own payment"`).
- Helper: *"set a due day and the payment shows up in Bills and on your runway — leave the $ blank and we'll pencil in a minimum"*
- **Always pay in full** toggle — *"the whole statement, every month — this card never carries a balance or interest, and the payment tracks the balance as it moves"*
- **Rewards** panel (`1px solid #e0d3bb; radius 10; padding:11px 12px; background:#faf5eb`): `Rewards` + *"what the card pays back — leave empty and we'll guess from the name"*; pills with inline `✕`; `[3%]` (86px) + `[groceries, gas, dining, travel…]` + `+ Add`.
- **Promotional rate?** toggle — *"0% intro APR and the like — with an end date, so the math never lies later"*; reveals `promo APR %` + `[6] months left`.
- `Add card` / `Save changes` + `Cancel`.

Toggle spec (also Settings): track `44×26; radius 999; background:{accent} | #e0d3bb`; knob `20×20; top:3px; left:3px; 50%; #fff; shadow 0 1px 3px rgba(41,34,26,.25); translateX(18px|0); .2s`.

---

### 1.7 `Settings` (line 619) — `view === 'settings'`

**Masonry**: `columns:340px; column-gap:16px`; panels `break-inside:avoid; margin:0 0 16px`.

1. **Profile** — 52px `#29221a` avatar with `{initials}` (18px/700 `#f6f0e6`; first letters of first two words). `Name`, `Email` inputs. Divider `#eee2cf`, right-aligned **`Sign out`** (`1.5px solid #e0d3bb`, radius 11, `padding:9px 16px`, 12.5px/650 `#5c5142`).
2. **Money** — `Current balance` / *"what's in checking right now"* 110px `$` field; `Paycheck amount` / *"what lands on payday"*; `Pay cycle` / *"how often you get paid"* + `next {paydayLabel}`, 3-up `Weekly | Every 2 weeks | Monthly`, `<input type="date">` next payday.
3. **Credit cards** — `{cardsSummaryLine}` = `"2 cards · $1,890.00 debt · $3,610.00 available"` or *"none yet — add them to unlock financing advice"*; **`Manage →`**.
4. **Notifications** — toggles: **`Bill reminders`** / *"nudge me the day before a bill is due"*; **`Payday summary`** / *"a recap when your paycheck lands"*.
5. **Run setup again** — *"the 2-minute first-run flow — replaces your data when you finish"* + **`Run setup`**.
6. **Reset app data** — *"wipes balances, bills, activity and goals back to the demo state"* + two-stage button: idle `Reset all data` (`1.5px solid #c2410c; color:#c2410c`), armed **`Tap again to confirm`** (`background:#c2410c; color:#fff`).

---

### 1.8 Auth — "Sign in" / "Sign up" (line 726)

Full-screen `position:fixed; inset:0; background:#f6f0e6; z-index:80; center; padding:24px`. Content `width:min(400px,100%); animation:fadeUp .25s ease-out`.
- Brand: 48px circle `3.5px solid #29221a` + 22×3.5px bar −35deg; **Runway** 27px/700/ls −.6px; tagline 13.5px `#8d8070` `max-width:280px`:
  - signup → *"One number tells you what's safe to spend, every day."*
  - signin → *"Welcome back — let's check your runway."*
- Card `#fffcf6/1px #e7dcc8/radius 22/padding 26`:
  - Heading 20px/700 — *"Create your account"* / *"Welcome back"*
  - Sub 12.5px `#8d8070` — *"Takes about a minute. No bank login required."* / *"Sign in to pick up where you left off."*
  - Fields (labels 11.5px/600 `#8d8070`; inputs `1px solid #e0d3bb; radius 11; padding:11px 13px; 14px; background:#faf5eb`): Name (signup, placeholder `Sam Rivera`), Email, Password (+`Show`/`Hide` 11.5px/650), Confirm (signup).
  - Error banner `background:#f7e5da; color:#c2410c; radius 10; padding:9px 12px; 12.5px/600`.
  - Submit — `Create account` / `Sign in`; `background:{accent}; color:#fff`.
  - `Forgot your password?` — signin, 12.5px/600 `#8d8070`, centered.
- Switch: `New to Runway?` **`Create an account`** / `Already have an account?` **`Sign in`** — 700 `#b45a26`, hover underline.
- Footnote: **`No bank login, ever · everything stays on your device.`** 12px `#a89b88`.

*Implementation note: replaced by Clerk components themed via appearance API to
this look; Clerk handles password reset.*

---

### 1.9 `Onboarding` (line 798) — 6 screens, z-index 70

Full-screen `#f6f0e6`, `width:min(440px,100%)`, `fadeUp .25s`. `obStep: null | 0..5`; starts at 0 only for un-set-up users.

**Step 0 — Welcome** (no card): 56px circle `4px solid #29221a` + 26×4px bar; **Runway** 34px/700/ls −.8px; *"One number tells you what's safe to spend, every day — after bills, after goals."* 15.5px/lh 1.55 `#5c5142` `max-width:300px`; **`Get started`** (`padding:14px 44px; radius 14; background:{accent}`); **`Takes about 2 minutes · no bank login — ever`**.

**Steps 1–5** share a card (radius 22, padding 26) with header: 30px `‹` back (`background:#f1e8d8`), `STEP n OF 5` 12px/650/ls .6px `#8d8070`, 5 dashes (`22×4px; radius 3`; filled `#29221a`, empty `#e0d3bb`).

| Step | Heading | Controls |
|---|---|---|
| 1 | **What's in your account right now?** | Underlined `$` input (`border-bottom:2px solid #29221a`; `$` 22px/600, value 30px/700), placeholder `6,000`. Hint *"Check your bank app. Close is fine, you can fix it later."* Next at ≥0. |
| 2 | **What's your paycheck?** | *"Your take-home pay after taxes. This sets how long your runway lasts."*; `$` placeholder `1,700`; `HOW OFTEN` 3-up `Weekly / Every 2 weeks / Monthly`; `NEXT PAYDAY` date; schedule line: *"Pick the date your next paycheck lands so Runway can count down to it."* / *"Every 2 weeks · next on Thu, Jul 30. On payday the app asks whether it landed."* |
| 3 | **What has to get paid?** | *"Rent, utilities, subscriptions — add the big ones; the rest can wait."*; rows `"due the 15th · $950.00"` (`"sub · $11.99"`) + `Edit`/`✕`; add = `[Rent, electric…]` + `$ [950]` + `due [15]` + `Add`; `ONE-TAP SUBSCRIPTIONS` chips **Netflix $15.49 · Spotify $11.99 · iCloud+ $2.99 · YouTube Premium $13.99 · Disney+ $9.99 · Gym $35** (selected → `"Netflix ✓"`); CTA `"Next — 3 bills · $1,069.00"` / `"Next — skip for now"`. |
| 4 | **Any credit cards?** | *"Add what you owe so Runway can plan payments and keep them off your safe-to-spend. Skip if you don't carry a balance."*; rows `"$650.00 / $2,000.00 · 21.9% APR"`; add = `[Card nickname…]` + `$ [owe]` + `[limit]` + `[APR] %` + `Add`; hint *"Rough numbers are fine — you can fine-tune APR and due dates later."*; CTA `"Next — 2 cards · $1,890.00 owed"` / `"Next — no cards"`. |
| 5 | **Where does the rest go?** | *"Pick what you spend on — we'll start each with a gentle budget you can tune later."*; chips: **Eating out $120 · Groceries $300 · Transit $60 · Fun $80 · Personal $60 · Coffee $40 · Shopping $90** (defaults on: eating out, groceries, transit); CTA `"Show me my number"` / disabled `"Pick at least one"`. |

Footer: **`Everything stays on this device.`** 12px `#a89b88`. From Settings: **`✕ Never mind — keep my data`** (13px/600 `#8d8070`, underlined) + `Escape` exit.

`obFinish()` replaces bills, cats, cards; `goals: []`, `txns: []`; writes cadence + nextPay; → runway.

---

### 1.10 `Personal loan` (line 937) — modal, z-index 50

Scrim `rgba(30,24,15,.45)`; sheet `#fffcf6; radius 22; padding 24; width:min(400px,100%); fadeUp .18s`.
- **"Borrowing from a friend"** 16px/700 + 30px `✕` (`background:#f1e8d8; color:#5c5142`).
- *"Cash today, no interest — the only thing that matters is paying it back when you said you would."*
- `WHO` → placeholder **`Maya, Dad, Chris…`** (`1.5px solid #e0d3bb; radius 11; 14.5px/600`)
- `HOW MUCH` → `$` · `PAY BACK BY` → date
- `{lnNote}` 12px, color `{lnNoteColor}`:
  - invalid → *"No interest, no fees — Runway just remembers who you owe and when."* (`#8d8070`)
  - due ≤ payday → *"Due Jul 24, before payday — this moves the shortfall rather than clearing it."* (`#c2410c`)
  - due > payday → *"Due Aug 5, after payday — $300.00 comes off that paycheck."* (`#8d8070`)
- CTA `"Add $300.00 from Maya"` / disabled `"Add the loan"`.
- Footer under `1px dashed #e0d3bb`: *"It lands in your balance today and shows up under Debt as "Pay back …" — no interest is ever added."*

---

### 1.11 `Payday confirm` (line 969) — modal, `width:min(380px,100%)`

- **"Payday"** + `✕`. Sub: **"Runway can't see your bank — did the paycheck land?"**
- Options:
  1. **`Yes — $1,700.00 landed`** — `padding:13px; radius 13; background:{accent}; color:#fff; 14.5px/650`
  2. **`A different amount…`** — `1.5px solid #29221a`, hover `background:#efe6d4`
  3. **`Not yet — ask me later`** — 13.5px/600 `#8d8070`, hover `background:#f1e8d8`
- Edit state: `$` input (`1.5px solid #29221a`) prefilled + **`Confirm`**; hint *"fewer shifts, overtime — the cycle plans around the real number"*.
- Footer: **"What happens next: goals get $142.00 first · bills reset for the new cycle · fresh safe/day"**

---

### 1.12 `Pay bill — pick source` (line 997) — modal, z-index **55**, `max-height:88vh; overflow-y:auto`

- Title `Pay {payBillName}`; sub `Paying **$950.00** — which source is it coming from?`
- Source rows (`1.5px solid #e0d3bb` → selected `#29221a` + `background:#faf5eb`; radius 14; `padding:12px 14px`):
  - 38px type icon tile (§4 acctMeta), name 14px/650, balance line: `{balF} now` (`#8d8070`) `·` `{afterF}`.
  - Cash: `"$400.00 left"` or `"−$550.00 — short"` `#c2410c`.
  - **Card** (offered unless bill IS that card's payment): `□` on `#5c5142`; `"$1,350.00 avail"` + `"charges the card · $1,600.00 owed"`, or `"over limit by $200.00"` `#c2410c`.
  - Right: 24px tick circle — selected `background:#29221a; color:#f6f0e6` `✓`; unselected `1.5px solid #d8cbb0; color:transparent`.
- CTA **`Mark paid`** (`#29221a`/`#f6f0e6`, radius 13). Footnote: **"we'll remember this source for Rent next time"** 11px `#a89b88`.

---

### 1.13 `Category` modal (line 1024) + shared activity row

- Title `New category` / `Edit category`.
- `NAME` → placeholder **`e.g. Groceries, Pets…`**
- `COLOR` → 10 swatches (30px circles, gap 11px), selected ring `box-shadow:0 0 0 2.5px #fffcf6, 0 0 0 4.5px {color}`.
- `MONTHLY BUDGET` → `$`, placeholder **`0 — leave blank for no limit`**
- **`Save category`**, plus **`Delete category`** (13px/600 `#c2410c`) when editing non-locked.

**Shared activity row + expand panel** (Dashboard + Activity):
```
row     : flex; align-items:center; gap:12px; padding:9–10px 0; cursor:pointer
icon    : rowIcon() by activityIcon prop:
          tile (default) 34×34, radius 11, bg {hue}1f, color {hue}
          solid          34×34, radius 11, bg {hue},   color #fffcf6
          ring           34×34, 50%, border 1.5px {hue}5c, color {hue}
          bare           22×34, no chrome, color {hue}
label   : 14px/600 ; meta 11.5px #8d8070 ("Today · from Main checking")
amount  : 14px/650 tabular ; #2e7d4f positive, else #29221a
chev    : › 17px #c3b6a1, rotate(0|90deg) .18s
panel   : flex; flex-wrap:wrap; gap:13px 22px; padding:12px 14px;
          background:{hue}14; border-radius:13px; margin:0 0 10px
fields  : CATEGORY / ACCOUNT / DATE — labels 10px/700/ls .9px #a89b88, values 13px
          (CATEGORY value takes the category hue at 700)
actions : "Change category" ⇄ "Pick one below…" (1px solid #d9cbb0, radius 10, 12px/650)
          "Delete" (1px solid #e2cfc0, color #c2410c, hover bg #f7ebdd)
picker  : category pills — selected pill borders/tints with its own color
```
Recategorize only for `isSpendTxn(t)` — negative amount whose cat matches a real
spending category. Bills, Income, Goals, Debt, Subscription rows keep their bucket.

---

### 1.14 `Accounts` modal (line 1053) — `width:min(400px,100%); max-height:88vh`

- **"Your accounts"**; sub **"Everything spendable — the total drives your runway."**
- Total banner: `#29221a/#f6f0e6; radius 16; padding:14px 18px` — `TOTAL BALANCE` 11px/700/ls .8px `#c9bda8` + `{balanceF}` 24px/700/ls −.5px.
- Account rows (`1px solid #e7dcc8; radius 14; padding:13px 15px; background:#fffdf8`): 38px icon tile (bank logo `<img>` on white `1px #eadfca; padding:5px` when picked, else glyph tile), name 14px/650, typeLabel 11.5px `#8d8070`, balance 15px/700, 28px `✎` and `✕` (radius 8, `background:#f1e8d8`). Synthetic primary row editable, not removable.
- **`+ Add an account`** dashed CTA.
- Form: `NAME` (placeholder **`e.g. Chase Checking, Wallet cash…`**), `TYPE` chips `Checking / Cash / Savings`, `LOGO` select (`Default icon`, `Chase`, `Bank of America`), `BALANCE` `$`, `Cancel` + `Add account` / `Save changes`.

---

### 1.15 `Add expense` modal (line 1129) — `width:min(400px,100%)`

- Title **`Add expense`** / **`Money in`** + `✕`.
- Segmented `expense | money in` (`1.5px solid #e0d3bb; radius 11`; expense active `#29221a`/`#f6f0e6`, income active **`#2e7d4f`**/`#fff`).
- Amount: `border-bottom:2px solid #29221a`; `$` 30px/700 `#8d8070`; input 40px/700/ls −1px, `inputMode="decimal"`, autoFocus, placeholder `0`.
- Chips: expense = all categories + dashed **`+ New`** (opens Category modal, returns here); income = `Side gig · Refund · Gift · Sold something · Other`.
- Expense: `PAYING FROM` chips = `Checking` + extra accounts + cards.
- Income: `WHAT'S IT FOR?` chips = `Keep it spendable` + `→ {goal}` per unfunded goal.
- Note placeholder `Note (optional) — coffee, tickets…` / `Note (optional) — dog-sitting, refund…`
- **Consequence-first save button**:
  | condition | label | style |
  |---|---|---|
  | amount empty/0 | `Enter an amount` | `#e7dcc8` / `#a89b88`, `cursor:default` |
  | income → pool | `Add $50.00 — spendable` | `#2e7d4f` / `#fff` |
  | income → goal | `Add $50.00 → Japan trip` | `#2e7d4f` / `#fff` |
  | expense, fits | `Add — leaves $23.50 in eating out` | `{accent}` / `#fff` |
  | expense, over | `Add — puts eating out over by $4.00` | `#c2410c` / `#fff` |

---

## 2. Interactions, handlers and flows

### 2.1 Modal / overlay stack

| Overlay | Trigger | z-index | Dismiss |
|---|---|---|---|
| Auth | `!authed` | 80 | submit |
| Onboarding | `obStep != null` | 70 | finish, or `✕`/`Escape` from Settings |
| Pay bill — pick source | unpaid bill checkbox / runway dot | **55** | scrim, `✕`, `Mark paid` |
| Add expense / Money in | `+` FAB, sidebar, crunch "Log money in" | 50 | scrim, `✕`, save |
| Category | `+ Add category`, Edit, `+ New` chip | 50 | scrim, `✕`, save (returns to Add-expense if `catReturn`) |
| Accounts | balance chip | 50 | scrim, `✕` |
| Payday confirm | payday dot | 50 | scrim, `✕`, "Not yet" |
| Personal loan | crunch "Borrow" | 50 | scrim, `✕`, `Escape` |

Scrims: `rgba(30,24,15,.45)`, click = close, inner stopPropagation.

### 2.2 Multi-step flows

**Onboarding** — `0 Welcome → 1 Balance → 2 Paycheck+cadence+next-payday → 3 Bills & subs → 4 Credit cards → 5 Categories → finish`. Back on every step; Next gates on validity (bal ≥ 0, pay > 0; steps 3–4 skippable). Enter advances (1–2) / adds a row (3–4).

**Pay a bill** — `promptPayBill(id, fromRunway)`:
- Already paid → immediate un-pay (reverses money, deletes `bill-{id}` txn). No prompt.
- Else → source picker prefilled `bill.payFrom || 'checking'` → confirm persists `payFrom`, applies payment, (from runway) starts fade.
- Effects: sets `paid`; **cash source** → debits account + pooled balance (credits back on un-pay); **card source** → card balance up, `updatedOff: 0`; **bill that IS a card payment** (`cardId`) → card balance down; synthetic txn `{id:'bill-'+id, label:name, amount:-amount, cat:'Bills', off:0, src}`.

**Runway fade** — paid from timeline: `opacity:0` via `transition:opacity .5s ease .7s`, node removed at 1300ms.

**Payday confirm** — `runPayday(amount)`:
1. `balance += amount`; log `Paycheck` income txn.
2. Per non-paused goal in order: `put = min(goalPer(g), target − saved, max(0, balance))`; subtract from balance; log `Set aside → {goal}`; add to saved. **Goals fund before anything else.**
3. Un-pause goals with `paused === '__crunch'`.
4. Drop paid one-time/personal bills; reset all others to `paid:false`.
5. Close modal. *(Implementation also advances nextPayday one cycle.)*

**Add expense** — always `cat.spent += amt`; then: **card** → card balance `+= amt`, `updatedOff:0`, txn src = card name, cash untouched; **extra account** → account + pooled balance decrease; **checking** → pooled balance decreases, src `'Main checking'`. Unknown category → `unc`.

**Money in** — `balance += amt`, income txn labelled from note or source (`Side gig / Refund / Gift / Sold something / Money in`); goal destination → `applied = min(amt, remaining)` immediately moved out as `Set aside → {goal}` txn.

**Cash-crunch** — auto when `safe < 0`. Stack levers until covered, then **Lock this plan** → chosen goals `paused:'__crunch'`; card advance adds `crunchAdvance` to card balance AND cash balance with `Advance from {card}` income txn.

**Necessity planner** — `Lock this plan in` pauses selected wishes (`paused: planName`), optionally charges card and creates a matching financing debt bill at ~10 days out with `amount = ceil(financed / months)`, creates goal with `saved = financed`, `financed`/`financedFrom` recorded, `per = ceil(plPer − remGap)`.

**Personal loan** — balance += amount, `Loan from {who}` income txn, bill `{name:'Pay back '+who, kind:'debt', personal:true, oneTime:true, lender, payFrom:'checking'}` due at chosen date.

**Card ↔ Bill sync** — keeps `{card} payment` debt bill in step with dueDay; amount = full balance (payInFull), else minPay, else existing, else `max(25, ceil(balance × 0.03))`. Runs from a single choke point on every card/bill-touching mutation.

**Delete / restore** — deleting a txn moves it to trash; **balances deliberately untouched** ("record only"). Restore puts it back at head; purge/clear discard.

### 2.3 Keyboard

`Enter` submits: bill form, goal edit, set-aside, card amount, reward add, loan, payday amount, auth, add-expense amount, onboarding 1–4. `Escape` cancels: bill form, goal edit, set-aside, card action, loan, onboarding-from-Settings.

---

## 3. Implied data model and formulas

### 3.1 State shape (design)

`{balance, bills, cats, txns, goals, pay, profile, notifBills, notifWeekly, cards, accounts, deletedTxns}`. `balance` = POOLED total (primary + Σ extra accounts); `primaryBalance = balance − Σ accounts[].balance`.

### 3.2 Seed / demo data (`defaults()`, lines 1252–1301)

- `balance: 6000`, `pay: 1700`, profile `{name:'Sam Rivera', email:'sam.rivera@gmail.com'}`, `notifBills: true`, `notifWeekly: false`, cadence biweekly.
- **Bills**: Rent $950 (off 3, survival) · Electric $74 (7) · Phone $45 (8) · Card A payment $160 (9, debt, cardId carda) · Netflix $15.49 (11, sub) · Spotify $11.99 (−6, sub, **paid**) · Gym $40 (13, sub).
- **Categories**: Groceries 300/182.40 `#5b8c5a` · Eating out 120/96.50 `#c9743d` · Transit 60/18 `#4f7fa8` · Fun 80/35 `#8b6fd8` · Personal 50/12 `#b8607e` · Uncategorized 0/0 `#a89b88` (locked).
- **Transactions** (14): Coffee −4.50 (0) · Lunch — burrito bowl −12.80 (0) · Groceries run −36.20 (−1) · Movie night −15 (−1) · Bus pass −18 (−3) · Set aside → Japan trip −85 (−3) · Pharmacy −9.40 (−4) · Spotify −11.99 (−6) · Groceries run −42.70 (−7) · Dinner with Sam −28.50 (−8) · Card A payment −160 (−9) · Venmo from Alex +22 (−10) · Rent −950 (−12) · Paycheck +1700 (−14).
- **Goals**: Japan trip 860/2400, per 85, due Apr 1 2027 · Emergency fund 400/1000, per 40, behind, note `'your safety net'`.
- **Cards**: Card B 21.9% APR, limit 2000, balance 650, promoRate 0, promoEnd +140d, updated −2d · Card A 17.9%, limit 3500, balance 1240, updated −34d.

### 3.3 ★ Safe-per-day — the core formula (lines 2105–2136)

```js
cadence = profile.cadence || 'biweekly'
CYCLE   = cycleDays(cadence)     // weekly 7 | semimonthly 15 | monthly 30 | daily 1 | else 14

DAYS = CYCLE
if (profile.nextPay) {
  d = round((nextPayMidnight − todayMidnight) / 86400000)
  if (isFinite(d)) DAYS = max(1, min(CYCLE, d))
}

unpaidBills = bills.filter(b => !b.paid)
// ONLY bills due BEFORE the next paycheck come out of today's balance
preBills    = unpaidBills.filter(b => b.off < DAYS)
preBillsSum = Σ preBills.amount

setAside = Σ goals where (saved < target && !paused) of goalPer(g)

safe   = balance − preBillsSum − setAside                       // "SAFE TO SPEND"
perDay = safe < 0 ? −ceil(−safe / DAYS) : floor(safe / DAYS)    // signed

// SUSTAINABILITY — what every future cycle can afford
payAmt        = pay ?? 1700
billsMonthly  = Σ bills where (!oneTime && !personal) of (cycle==='yearly' ? amount/12 : amount)
billsPerCycle = billsMonthly * CYCLE / 30.44
cycleSurplus  = payAmt − billsPerCycle − setAside
sustainDay    = cycleSurplus < 0 ? −ceil(−cycleSurplus / CYCLE) : floor(cycleSurplus / CYCLE)

effDay        = min(perDay, sustainDay)     // THE NUMBER ON SCREEN
squeezed      = sustainDay < perDay
overCommitted = cycleSurplus < 0
```

`dayF(n) = (n < 0 ? '-$' : '$') + Math.abs(n)` — no cents, no separators.

Computed-but-unrendered explanatory strings (v1 kept them unrendered):
- `heroMath`: `"= $1,700.00 paycheck − $713.11 bills − $142.00 goals, every cycle"` / `"= $6,000.00 balance − $1,069.00 bills due before payday − $142.00 goals"`
- `coachLine`: `"Heads up: rent ($950.00) is your next bill, due Jul 18. …"` / `"Every bill is paid this cycle — your daily number is fully yours."`

`perDaySub`: `effDay ≥ 0` → **`"a pace that lasts past payday"`**; shortfall this cycle → `"$142.00 short before payday — trim a bill or stretch a goal"`; structural → `"$85.00 short each paycheck — trim a bill or stretch a goal"`.

### 3.4 Runway timeline geometry (lines 2166–2219)

```js
future = bills.filter(b => b.off >= 0 && (!b.paid || fading)).sort(byOff)
maxOff = max(DAYS, ...future.map(off), 1)

events = [...future.map(b => ({off, bill:true})), {off: DAYS, payday:true}]
         .sort((a,b) => a.off − b.off || (a.payday ? 1 : −1))   // payday LAST on tie

// pass 1 — position by date, then push apart
billIdx = 0; prevAny = −99; prevSide = {above:−99, below:−99}
for (ev of events) {
  ev.side = ev.payday ? 'below' : (billIdx++ % 2 === 0 ? 'above' : 'below')
  p = 9 + (ev.off / maxOff) * 82                    // rail spans 9%..91%
  if (p < prevAny + 7)            p = prevAny + 7   // min gap
  if (p < prevSide[ev.side] + 13) p = prevSide[ev.side] + 13  // same-side gap
  prevAny = p; prevSide[ev.side] = p; ev.pct = p
}
// pass 2 — compress back into 9–91% if overrun
if (last.pct > 91) { k = (91−9)/(last.pct−9); each ev.pct = 9 + (ev.pct−9)*k }
```
Payday always below the rail; bills alternate above/below in date order.
Mobile spine: `marginTop = round(clamp(gapDays × 7, 16, 82))px`.

### 3.5 Goal math (lines 1303–1332)

```js
goalRemaining(g) = max(0, round2(target − saved))
goalDays(g)      = due ? max(0, round((due − now)/86400000)) : null
goalChecks(g)    = days == null ? null : max(1, floor(days / cycleDays(cadence)))
goalPer(g)       = remaining <= 0 ? 0
                 : !due ? (per || 0)
                 : min(remaining, ceil(remaining / goalChecks(g)))
goalPerMonth(g)  = remaining <= 0 ? 0
                 : days == null ? min(remaining, ceil((per||0) * (30.44 / CYCLE)))
                 : (months = max(1, floor(days / 30.44)),
                    min(remaining, ceil(remaining / months)))
goalBehind(g)    = saved >= target ? false
                 : (!due || !per) ? !!g.behind
                 : ceil(remaining / goalChecks(g)) > per + 0.5
// bar split
finPart = min(financed || 0, saved);  payPart = max(0, saved − finPart)
finPct  = min(100, finPart/target*100);  payPct = clamp(payPart/target*100, 0, 100−finPct)
```
Goal edit: per-paycheck within $1 of computed → keep due date live; else pin amount, clear due. Goal delete: `saved` returns to balance, logs `Returned from {goal}`.
Spare: `spare = round(cycleSurplus * 30.44 / CYCLE / 10) * 10`; projection horizon 10 months.

### 3.6 Planner / necessity math (lines 2440–2554)

```js
plPer      = target / (months × 2)          // assumes 2 paychecks/month
plFree     = max(0, cycleSurplus)
plSpare    = max(0, safe)
plSparePer = plSpare / (months × 2)
plCap      = plFree + plSparePer
gap0       = plPer − plCap
plOver     = plPer > plCap
plCushioned= plPer > plFree && !plOver
freed      = Σ goalPer of paused wish choices
remGap     = max(0, gap0 − freed)
financed   = card ? min(ceil(remGap × months × 2), floor(limit − balance), ceil(target)) : 0
interest   ≈ eff === 0 ? 0 : ceil(financed × eff/100 × months / 24)
necCovered = gap0 <= 0 || remGap <= 0 || (card && financed >= ceil(remGap×months×2) − 1) || coverEarn
```

`plPerLine` strings (per-day copy divides by hard-coded 14):
- wish, over → *"That's $200 per paycheck — more than the $150 each cycle can free up, even counting the $400 spare in your balance. Pick a later month."*
- wish, cushioned → *"That's $200 per paycheck — your $400 spare balance covers what the cycles can't. About $15/day less to spend."*
- wish, fits → *"That's $85 per paycheck — about $6/day less to spend."*
- necessity, fits + cushioned → *"That's $200 per paycheck — fits, thanks to the $400 spare in your balance."*
- necessity, fits → *"That's $85 per paycheck — it fits without denting your daily number."*
- necessity, short → *"$200 per paycheck needed — $50 more than your cycles + $400 spare balance can free up. Find it below ↓"*

Levers copy: *"Pause "Japan trip" set-asides"* / *"frees $85.00 / paycheck while this plan runs"* · *"Put the rest on Card B · 0% until Dec 2026"* or *"· 17.9% APR"* / *"≈$1,200.00 financed · $0 interest if cleared before the promo ends"* or *"≈$95.00 interest over 6 mo"* · *"Earn the rest"* / *"about $100.00/mo more — log it with the + as money in when it lands"* · *"Add your cards to see credit options"* / *"Cards tab — APR, limit, balance off the statement"*.

### 3.7 Credit-card math

```js
effApr(c) = (promoRate != null && promoEndOff > 0) ? promoRate : apr   // sort key
r = apr/1200; P = payment; B = balance
if (P > B*r) { months = ceil(−ln(1 − r*B/P) / ln(1+r)); interest = max(0, round(P*months − B)) }
pct = min(100, balance/limit*100); barColor = ≥80% ? '#c2410c' : '#29221a'
available = max(0, Σ limits − Σ balances)
minGuess = max(25, ceil(balance × 0.03))
promoMonths = max(1, round(promoEndOff/30))
```

Five `cd.line` variants:
1. `"Paid off — $2,000.00 available"` (`#2e7d4f`)
2. `"Pays in full Jul 21 — $650.00, $0 interest"` (`#2e7d4f`) / `"Pays in full — add a due day so it lands on your runway"` (`#c2410c`)
3. `"⏳ 0% ends Dec 2026 (5 mo) — clear $650.00 by then or it costs 21.9%"` (`#c2410c` if <90d left, else `#5c5142`)
4. `"At $160.00/mo → clear by Mar 2027 · ≈$140.00 interest on the way"` / `"$5.00/mo doesn't cover the interest — raise the payment"` (`#c2410c`)
5. `"No due date set — Edit to add one · interest ≈ $18.00/mo at 17.9%"`

Reward auto-suggestion by nickname (13 regex rules): Freedom Unlimited (1.5% everything else, 3% dining, 3% drugstores) · Quicksilver/Unlimited Cash (1.5%) · Freedom Flex/Discover it (5% rotating, 1% else) · Blue Cash Preferred (6% groceries, 6% streaming, 3% gas) · Blue Cash (3/3/3) · Amex Gold (4x restaurants, 4x groceries, 3x flights) · Sapphire (3x dining, 2x travel) · Custom Cash (5% top category, 1% else) · Double/Active Cash (2%) · Venture (2x travel, 2x else) · Costco (4% gas, 3% restaurants, 2% Costco runs) · Amazon/Prime (5% Amazon, 5% Whole Foods, 2% gas) · Apple (3% Apple, 2% Apple Pay).

### 3.8 Cash-crunch math (lines 2813–2869)

```js
crunchOn    = safe < 0
crunchShort = ceil(−safe)
run = balance
for (b of preBills byOff) { run −= b.amount; if (run < 0) { crunchBill = b; break } }
crunchFreed   = Σ goalPer of chosen paused goals
crunchRem     = max(0, crunchShort − crunchFreed)
crunchAdvance = card ? min(crunchRem, floor(limit − balance)) : 0
crunchCovered = crunchOn && (crunchRem − crunchAdvance) <= 0 && (crunchFreed > 0 || crunchAdvance > 0)
cardInterest  ≈ max(1, round(amount × apr / 1200))
```
Lever lists pre-sorted cheapest first (goals before cards; cards by effective APR asc).

### 3.9 Formatting

```js
fm(n): cents → toLocaleString('en-US', 2dp) else round; prefix (neg ? '−$' : '$')
       // U+2212 MINUS SIGN, not hyphen
d(off) = date.toLocaleDateString('en-US',{month:'short',day:'numeric'})  // "Jul 30"
dayF(n) = (n < 0 ? '-$' : '$') + |n|    // ASCII hyphen — hero + sidebar only
ordSuf(n) = 'st'|'nd'|'rd'|'th'
```
Every number: `font-variant-numeric: tabular-nums`.

---

## 4. Design tokens

### 4.1 Color

```
/* surfaces */
--bg              #f6f0e6    --surface   #fffcf6   --surface-alt #fffdf8
--input           #faf5eb    --scrim     rgba(30,24,15,.45)
/* ink */
--ink #29221a  --ink-2 #5c5142  --muted #8d8070  --muted-2 #a89b88
--placeholder #b3a48f  --chevron #c3b6a1  --icon-idle #d8cbb0
/* borders & tracks */
--border #e7dcc8  --border-input #e0d3bb  --border-dash #d8c9ab/#d9cbb0/#d5c5a8
--rail #e0d3bb  --divider #f0e7d6  --divider-2 #eee2cf
--track #efe6d4  --track-over #f3d9cc
/* fills / hovers */
--chip #f1e8d8  --chip-2 #eee7d9  --hover-nav #ede3d0  --hover-soft #efe6d4
--hover-pill #f6efe1  --hover-stepper #f3ead9  --hover-drop #f3ead8
--hover-danger #f7ebdd  --acct-remove-hov #f5ddd0
/* accents */
--accent #2E8C5A (alternates #D9772E, #8B6FD8)
--link #b45a26 (hover #8a3f14)
--danger #c2410c  --danger-hero #c2542a  --danger-hero-2 #e58c5b
--success #2e7d4f  --goals #8b6fd8  --financed #5c5142
/* on-dark */
--on-dark #f6f0e6  --on-dark-muted #b8a98f  --on-dark-muted-2 #c9bda8
--crunch-accent #e58b6b  --crunch-ok #7fc79b
/* misc */
--restore-border #cbe0cf  --restore-hover #e9f2ea  --err-bg #f7e5da
--bill-flag #e5b48a
```

**Category palette** (10 swatches, round-robin, first-unused-wins):
`#5b8c5a` `#c9743d` `#4f7fa8` `#8b6fd8` `#b8607e` `#3f9a92` `#c69a3d` `#6b6fc9` `#cf6a5a` `#7a8c3d`

**System category hues**: Income `#2e7d4f` · Bills `#5c5142` · Debt `#c2410c` · Subscription `#8b6fd8` · else `#a89b88`. Icon tiles `{hue}1f` bg; expand panels `{hue}14`; ring borders `{hue}5c`.

**Reward-pill palette** (`catPill`):
| match | bg | fg |
|---|---|---|
| grocer/supermarket/whole foods/costco run | `#e3eedd` | `#2e5c38` |
| gas/fuel | `#f4e3cf` | `#8a5a1e` |
| restaurant/dining/food | `#f6ded7` | `#9c4326` |
| travel/miles/hotel | `#dce7ee` | `#2f5a74` |
| stream/apple/amazon/online/drugstore | `#e7deef` | `#5b4176` |
| rotating/quarter/top category | `#f2e8cc` | `#77621f` |
| default | `#eee7d9` | `#5c5142` |

**Account types** (`acctMeta`):
| type | label | glyph | bg | fg |
|---|---|---|---|---|
| checking | Checking | `⌂` | `#29221a` | `#f6f0e6` |
| cash | Cash | `$` | `#2e6d4f` | `#eef6f0` |
| savings | Savings | `★` | `#8b6fd8` | `#f4f0fc` |

### 4.2 Typography

**Instrument Sans** 400/500/600/700, fallback `system-ui, sans-serif`, antialiased. (Weight 650 appears throughout — normalize via variable font axis.)

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Hero number | clamp(42px,6vw,58px) | 700 | −1.5px, lh 1.05 |
| Add-expense amount | 40px input / 30px `$` | 700 | −1px |
| Crunch number | clamp(36px,5vw,48px) | 700 | −1.2px |
| Onboarding welcome | 34px | 700 | −.8px |
| Onboarding amount | 30px / 22px `$` | 700 | −.5px |
| Goals spare / Accounts total | 30px / 24px | 700 | −.5px |
| Auth brand | 27px | 700 | −.6px |
| Page title | clamp(22px,3vw,28px) | 700 | −.4px |
| Sidebar safe/day | 26px | 700 | −.5px |
| Stat / goal per-month | 22px | 700 | −.5px |
| Card summary tiles | 20px | 700 | — |
| Auth heading / onboarding step | 20px | 700 | −.3px |
| Sidebar wordmark | 18px | 700 | −.3px |
| Modal title | 16px | 700 | — |
| Bill/goal/card names | 14.5–15px | 600–700 | — |
| Body / list row | 14px | 600 | — |
| Buttons / inputs | 13.5px | 650 | — |
| Section headings | 13px | 700 | .3px |
| Meta / chips | 12–12.5px | 600–650 | — |
| Sub-meta | 11.5px | 400–650 | — |
| Uppercase eyebrows | 11px | 700 | .8px |
| Detail-panel labels | 10px | 700 | .9px |

### 4.3 Radii, spacing, shadows

```
Radii   999 pills/toggles/chips · 22 modals/auth cards · 20 content cards
        18 drop-group wrap · 16 stat cards/total banner · 14 rows/tiles
        13 primary buttons/expand panels · 12 · 11 icon tiles/nav/inputs
        10 inputs/small buttons · 9 · 8 icon buttons · 7 checkboxes/levers
        5–6 progress bars/tags · 50% circles

Spacing page gutter clamp(16px,3vw,32px); bottom pad 110px
        card padding 20 (content) / 24 (modals) / 26 (auth+onboarding)
        / 14×16 tiles / 13×16 rows; section gap 16; list gap 8–13; chips 6–8
        grid minmax: 290 dashboard / 320 bills+goals+cards / 340 activity+settings

Shadows phone nav: 0 16px 40px rgba(41,34,26,.24), 0 2px 8px rgba(41,34,26,.1),
                   inset 0 1px 0 rgba(255,255,255,.9), inset 0 -1px 0 rgba(41,34,26,.05)
        pad nav  : 0 10px 30px rgba(41,34,26,.22), inset 0 1px 0 rgba(255,255,255,.7)
        FAB      : 0 12px 28px rgba(41,34,26,.3), inset 0 1.5px 0 rgba(255,255,255,.4)
        active nav item: 0 4px 12px rgba(41,34,26,.3), inset 0 1px 0 rgba(255,255,255,.15)
        toggle knob: 0 1px 3px rgba(41,34,26,.25)
        swatch ring: 0 0 0 2.5px #fffcf6, 0 0 0 4.5px {color}
Glass   phone: rgba(252,248,240,.5) + blur(26px) saturate(1.9), border rgba(255,255,255,.75)
        pad  : rgba(252,248,240,.6) + blur(20px) saturate(1.7), border rgba(255,255,255,.65)
        safe-area via env(safe-area-inset-bottom)
```
Cards have **no** drop shadow — depth is the `#fffcf6`-on-`#f6f0e6` tonal step + 1px `#e7dcc8` hairline. Shadows only on floating chrome.

### 4.4 Motion

```css
@keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
@keyframes pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(41,34,26,.22)}
                    50%    {box-shadow:0 0 0 9px rgba(41,34,26,0)} }
```
- `fadeUp .25s` auth/onboarding; `.18s` modals + inline forms.
- `pulse 2.4s infinite` payday dot only.
- Bar fills `width .35s`. Hovers `.15s`. Primary hover `brightness(1.07)` (dark-on-dark `1.10–1.25`).
- Nav pill `.2–.25s`; phone nav active `scale(.92)`.
- Chevron `.18s`; checkbox hover `scale(1.12)`; runway dot `scale(1.18)`.
- Swipe release `transform .28s cubic-bezier(.2,.8,.2,1)`.
- Runway fade `opacity .5s ease .7s`, removal 1300ms.

### 4.5 Dark mode — filter inversion

```css
@media (prefers-color-scheme: dark) {
  html { filter: invert(0.92) hue-rotate(180deg) saturate(1.08); }
  html, body { background: #141019; }
}
```
`invert(0.92)` keeps warmth; filter also inverts bank logos and glass; `#141019` behind the filtered root.

---

## 5. Design-history notes

### 5.1 Wireframes → hi-fi

Wireframes (8 turns) show: three dashboard concepts (`1c` "Runway" timeline won over "One number" 50/30/20 and "Envelopes"); task-flow studies; a "middle way" hero+spine that partially shipped (mobile spine yes; dashed "nothing due" stretch and echo footer no). The hi-fi added, beyond wireframes: cash crunch + levers, personal loans, multiple accounts + pay-source picker, auth, Uncategorized locked category, recently-deleted trash, pay-in-full cards + card↔bill sync, rewards system (reversing t6's "no rewards"), six-tab nav (Cards restored top-level). The custom numpad was dropped for the system keyboard. Bill `autopay`/`flag` tags have render support but are never set in defaults — do not implement setters.

### 5.2 Activity row: final = `1a` day-groups + `2b` tap-to-expand, with `Edit` replaced by `Delete` and a two-state "Change category" ⇄ "Pick one below…" inline pill picker.

### 5.3 Screenshots vs. markup

Screenshots predate the final markup: they show two-letter mono badges (`BI`, `EA`) where the final design renders icon tiles; accent renders green `#2E8C5A` (the prop default — use it). `accts-1/2.png` confirm runway labels (`Payday · Jul 30`, `+$600.00`, `−$142.00 → goals`) and that adding a cash account moves the balance chip but not a sustainability-clamped safe/day.

### 5.4 Dead / unwired values — do not implement

`heroMath`, `coachLine`, `subsF`, `billsUnpaidF`, `billsLeftCount`, merged `crunchLevers`, `paydayMGap`, `plMonthOpts`, `plSpare` (rendered nowhere), per-row `mono`/`dotStyleM`/`gapLabel`/`spentF`/`budgetF`/`catText` on dashboard rows, `Forgot your password?` (Clerk handles reset), `cd.startEditBal` (no trigger in markup — only `Log payment` is wired).
