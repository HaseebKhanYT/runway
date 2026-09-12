import {
  cardPaymentDue,
  computeRunway,
  cycleDays,
  cyclesPerMonth,
  daysUntil,
  effectiveApr,
  goalPerPaycheck,
  perPaycheckFor,
  type AppState,
  type Cadence,
  type Card,
  type Goal,
  type RunwaySummary,
} from '@runway/shared';
import {formatMoney} from './format';

export interface PlanInput {
  name: string;
  target: number;
  months: number;
  kind: 'wish' | 'necessity';
  pausedIds: string[];
  cardId: string | null;
  earn: boolean;
}

export interface PlanLever {
  kind: 'pause' | 'card' | 'earn' | 'extend' | 'add-cards';
  id: string;
  title: string;
  sub: string;
  /** For the extend lever: the term it moves the plan to. */
  months?: number;
}

/** What the runway looks like the moment after this plan is locked in. */
export interface PlanProjection {
  safe: number;
  cycleSurplus: number;
  effectivePerDay: number;
}

/** A term that runs past the card's promotional rate. */
export interface PromoCliff {
  /** Months of the term still covered by the promo. */
  covered: number;
  /** Months billed at the card's standard rate instead. */
  exposed: number;
  reversionApr: number;
  ends: string;
}

export interface PlanSummary {
  perPaycheck: number;
  free: number;
  spare: number;
  /** The largest per-paycheck set-aside that still leaves the day at zero. */
  cap: number;
  initialGap: number;
  over: boolean;
  freed: number;
  remainingGap: number;
  financed: number;
  interest: number;
  /** Principal plus interest — what the plan costs in total. */
  totalCost: number;
  /** Extra income per month the "Earn the rest" lever is asking for. */
  earnMonthly: number;
  /** The runway as it will read once this plan is locked in. */
  projection: PlanProjection;
  /** The projected runway survives this cycle — nothing goes negative now. */
  solvent: boolean;
  /** Every cycle after this one carries the plan without dipping into savings. */
  sustainable: boolean;
  /** Soonest term that gets the day back to zero, or null if none within reach. */
  minViableMonths: number | null;
  promoCliff: PromoCliff | null;
  covered: boolean;
  perLine: string;
  perColor: string;
  levers: PlanLever[];
  gapLine: string;
  ctaLabel: string;
  ctaEnabled: boolean;
}

/** How far the term search looks before it calls a plan unaffordable. */
const MAX_TERM_MONTHS = 60;

/**
 * How many passes the card sizing loop gets to converge on a principal. The
 * step only ever approaches the answer from below, so this budget is how much
 * convergence the loop is allowed to buy rather than a guard against runaway:
 * cut it and the loop stops a few dollars of principal short and refuses a plan
 * the card could in fact carry.
 */
const MAX_SIZING_PASSES = 20;

/** Local-parts ISO date, matching how the server stamps a plan's due date. */
function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** One candidate plan, measured against the runway it would leave behind. */
interface Evaluation {
  runway: RunwaySummary;
  /**
   * What the plan actually costs per paycheck. Not `target / (months × 2)`:
   * the set-aside the runway charges is `goalPerPaycheck`, which counts the
   * paychecks that land before the due date, and a term of N months rarely
   * contains exactly 2N of them. Quoting the arithmetic figure understated
   * every plan whose due date fell short of a whole number of cycles.
   */
  per: number;
  financed: number;
  /**
   * How much per paycheck this plan must stop asking for before the daily
   * number climbs back to zero. `safe` and `cycleSurplus` each move dollar for
   * dollar with the set-aside and `effectivePerDay` is the worse of the two,
   * so the larger of the two deficits is the whole shortfall.
   */
  shortfall: number;
}

/**
 * The state this plan would leave behind, built the same way the server builds
 * it: the card carries the principal and a term, its payment bill is restated
 * by the shared `cardPaymentDue`, paused wishes stop asking for money, and the
 * new goal joins the set-asides. Running the real `computeRunway` over this is
 * what makes the projection trustworthy — the planner and the runway cannot
 * drift apart, because there is only one calculation.
 */
function projectState(
  input: PlanInput,
  state: AppState,
  financed: number,
  months: number,
  today: Date,
): {state: AppState; planned: Goal} {
  const card = input.cardId ? state.cards.find((c) => c.id === input.cardId) : undefined;
  const installment = financed > 0 ? Math.ceil(financed / months) : 0;

  const cards = state.cards.map((c) =>
    c.id === card?.id && financed > 0
      ? {
          ...c,
          balance: c.balance + financed,
          planInstallment: c.planInstallment + installment,
          planMonthsLeft: Math.max(c.planMonthsLeft, months),
        }
      : c,
  );

  const projectedCard = cards.find((c) => c.id === card?.id);
  const bills = state.bills.map((b) =>
    projectedCard && b.cardId === projectedCard.id
      ? {...b, amount: cardPaymentDue(projectedCard, b.amount)}
      : b,
  );

  const due = new Date(today.getFullYear(), today.getMonth() + months, 1);
  const dueIso = isoLocal(due);
  const planned: Goal = {
    id: '__planned',
    name: input.name || 'This plan',
    target: input.target,
    saved: financed,
    // The shared `Goal` type requires `per`, and this goal is handed to the
    // real `computeRunway`, so the field cannot simply go. Computing it with
    // the same helper `goalPerPaycheck` reads it back with — over the same
    // `dueIso` printed beside it — is what stops the stored figure and the date
    // it is derived from disagreeing.
    per: perPaycheckFor(Math.max(0, input.target - financed), dueIso, state.profile.cadence, today),
    note: '',
    due: dueIso,
    necessity: input.kind === 'necessity',
    paused: null,
    behind: false,
    financed,
    financedFrom: financed > 0 ? (card?.name ?? null) : null,
    earnMonthly: 0,
  };

  const goals = state.goals
    .map((g) => (input.pausedIds.includes(g.id) ? {...g, paused: input.name || 'this plan'} : g))
    .concat(planned);

  return {state: {...state, cards, bills, goals}, planned};
}

/**
 * Price one candidate term against the real runway. The card is sized here
 * rather than by the caller because the shortfall it is meant to close is
 * itself a projected figure: what the plan asks for once the paused wishes
 * have given back what they can.
 */
function evaluate(
  input: PlanInput,
  state: AppState,
  months: number,
  today: Date,
  card: Card | undefined,
): Evaluation {
  const bare = projectState(input, state, 0, months, today);
  let projected = bare;
  let runway = computeRunway(bare.state, today);

  // Charge the card the shortfall the lever advertises and no more (#17),
  // bounded by the headroom it actually has and by the plan itself.
  //
  // Each step is a first-order estimate that ignores its own feedback: the
  // installment the new principal buys lands in the bills, so part of the
  // shortfall the step was sized to close is pushed straight back. That is why
  // the figure is re-measured and topped up rather than trusted first time —
  // otherwise the lever stops short of the goal it was chosen to reach and the
  // plan reads as refused over $0.28. It also means the iteration only ever
  // approaches the answer from below, never past it, so the pass budget is a
  // convergence allowance and not a formality: at four passes a monthly plan
  // was still refused $3.48 a paycheck short of a term it could in fact carry.
  // The loop is capped either way, by the budget and by `ceiling`.
  //
  // `residual` is per paycheck and `months` is calendar months, so the step
  // between them is `cyclesPerMonth` — paychecks a month, all four of them.
  // A flat 2 sized each step at under half what a weekly card's residual implies
  // and at twice what a monthly card's does. That is the length of the stride,
  // not the destination: both walk up from below, so an over-long stride
  // overshoots the principal on one plan and, once the budget runs out, stops
  // short of it on another.
  let financed = 0;
  if (card) {
    const ceiling = Math.min(
      Math.max(0, Math.floor(card.limit - card.balance)),
      Math.ceil(input.target),
    );
    for (let pass = 0; pass < MAX_SIZING_PASSES; pass++) {
      const residual = shortfall(runway);
      if (residual <= 0 || financed >= ceiling) break;
      const next = Math.min(
        ceiling,
        financed + Math.ceil(residual * months * cyclesPerMonth(state.profile.cadence)),
      );
      if (next <= financed) break;
      financed = next;
      projected = projectState(input, state, financed, months, today);
      runway = computeRunway(projected.state, today);
    }
  }
  return {
    runway,
    per: goalPerPaycheck(projected.planned, state.profile.cadence, today),
    financed,
    shortfall: shortfall(runway),
  };
}

function shortfall(r: RunwaySummary): number {
  return Math.max(0, -r.safe, -r.cycleSurplus);
}

/**
 * The soonest term that gets the daily number back to zero, which is the
 * answer the "give it longer" lever exists to give. Scanning is what makes the
 * lever terminate: offering a fixed +6 months left the user clicking until
 * something happened, with no promise that anything ever would.
 */
function minViableTerm(
  input: PlanInput,
  state: AppState,
  today: Date,
  card: Card | undefined,
  from: number,
): number | null {
  for (let m = from + 1; m <= MAX_TERM_MONTHS; m++) {
    if (evaluate(input, state, m, today, card).shortfall === 0) return m;
  }
  return null;
}

/**
 * Interest over the term. The existing shape — rate × months / 24 — is applied
 * once per rate rather than once overall, so a term that outruns a promotional
 * window is costed at the promo rate for the months it covers and at the
 * card's standard rate for the rest. Quoting $0 for a 24-month plan on a
 * 12-month promo is the thing this is here to stop.
 */
function planInterest(card: Card | undefined, financed: number, months: number, today: Date) {
  if (!card || financed <= 0) return {interest: 0, cliff: null as PromoCliff | null};
  const promoRate = effectiveApr(card, today);
  const onPromo = promoRate !== card.apr && card.promoEnd != null;
  const promoMonths = onPromo
    ? Math.max(0, Math.floor(daysUntil(card.promoEnd as string, today) / 30))
    : months;
  const covered = Math.min(months, promoMonths);
  const exposed = Math.max(0, months - covered);

  const at = (rate: number, m: number) =>
    rate === 0 || m <= 0 ? 0 : Math.ceil(((financed * rate) / 100) * (m / 24));
  const interest = at(promoRate, covered) + at(card.apr, exposed);

  return {
    interest,
    cliff:
      onPromo && exposed > 0
        ? {covered, exposed, reversionApr: card.apr, ends: card.promoEnd as string}
        : null,
  };
}

/** Big-expense planner math (catalog §3.6) — exact copy strings. */
export function computePlan(
  input: PlanInput,
  state: AppState,
  runway: RunwaySummary,
  today: Date,
): PlanSummary {
  const months = Math.max(1, input.months);
  const free = Math.max(0, runway.cycleSurplus);
  const spare = Math.max(0, runway.safe);

  const card: Card | undefined = input.cardId
    ? state.cards.find((c) => c.id === input.cardId)
    : undefined;

  // The plan as typed, before any lever — this is what the headline quotes and
  // what decides whether the levers appear at all.
  const bare = evaluate({...input, pausedIds: []}, state, months, today, undefined);
  const per = bare.per;
  const initialGap = bare.shortfall;
  const over = initialGap > 0;
  // What a paycheck could carry without the day going red. Derived from the
  // projection rather than assumed: the old `free + spare / paychecks` counted
  // the balance as if it arrived again every cycle, which is precisely how a
  // plan could read "covered" while the daily number sat at −$122.
  const cap = Math.max(0, per - initialGap);

  const cadence = state.profile.cadence;
  const pausableWishes = state.goals.filter(
    (g) =>
      !g.necessity && !g.paused && g.saved < g.target && goalPerPaycheck(g, cadence, today) > 0,
  );
  const freed = pausableWishes
    .filter((g) => input.pausedIds.includes(g.id))
    .reduce((sum, g) => sum + goalPerPaycheck(g, cadence, today), 0);

  // The plan as it stands, with every lever the user has picked applied.
  const now = evaluate(input, state, months, today, card);
  const financed = now.financed;
  const remainingGap = now.shortfall;
  const {interest, cliff} = planInterest(card, financed, months, today);
  const totalCost = financed + interest;
  // The figure the "Earn the rest" lever quotes, hoisted out of the lever list
  // so the same number can be sent to the server and recorded on the plan.
  // `remainingGap` is per paycheck and the lever is quoted per month, so the
  // conversion is `cyclesPerMonth` — the same divisor `spareMonthly` uses for
  // the surplus read a few inches away on the same screen.
  const earnMonthly = Math.ceil((remainingGap * cyclesPerMonth(cadence)) / 10) * 10;

  const projection = {
    safe: now.runway.safe,
    cycleSurplus: now.runway.cycleSurplus,
    effectivePerDay: now.runway.effectivePerDay,
  };
  const solvent = projection.safe >= 0;
  const sustainable = projection.cycleSurplus >= 0;
  // The bar is the number on the hero: what this plan leaves you to spend per
  // day. `effectivePerDay` is `min(thisCyclePerDay, sustainablePerDay)`, so
  // holding it at or above zero means the plan survives both this cycle and
  // every cycle after it — the first paid for out of the balance, the second
  // out of the paycheck. A lever that finds the money but drives the daily
  // number below zero has not solved anything, so sourcing alone is not
  // coverage (#37).
  const covered = projection.effectivePerDay >= 0;

  const isNecessity = input.kind === 'necessity';
  const perLine = buildPerLine(input.kind, per, cap, over, initialGap, cadence);
  const perColor = isNecessity
    ? over && !covered
      ? '#c2410c'
      : '#2e7d4f'
    : over
      ? '#c2410c'
      : '#8b6fd8';

  // Only worth searching when something has to give, and keyed off the plan as
  // typed so the answer does not move as levers are toggled.
  const minViableMonths =
    isNecessity && over ? minViableTerm(input, state, today, card, months) : null;

  const levers: PlanLever[] = [];
  // Keyed off the plan as typed, not off the current verdict: were these to
  // disappear the moment the plan came good, the pause and card the user just
  // picked would vanish with them and could not be undone.
  if (isNecessity && over) {
    // Cheapest first now means debt last. Pausing, stretching the term and
    // earning cost nothing; a card lever is the only one that ends in
    // interest, so it stops being the first answer offered.
    for (const g of pausableWishes) {
      levers.push({
        kind: 'pause',
        id: g.id,
        title: `Pause “${g.name}” set-asides`,
        sub: `frees ${formatMoney(goalPerPaycheck(g, cadence, today))} / paycheck while this plan runs`,
      });
    }
    // The term that actually works, not a fixed step towards it. When no term
    // inside `MAX_TERM_MONTHS` works, the lever is left out rather than
    // offered as a move that cannot deliver what its label promises.
    if (minViableMonths != null) {
      const extra = minViableMonths - months;
      levers.push({
        kind: 'extend',
        id: 'extend',
        months: minViableMonths,
        title: `Give it ${extra} more month${extra === 1 ? '' : 's'}`,
        sub: `${formatMoney(evaluate(input, state, minViableMonths, today, card).per)} per paycheck instead of ${formatMoney(per)} — no interest, no paused wishes`,
      });
    }
    levers.push({
      kind: 'earn',
      id: 'earn',
      title: 'Earn the rest',
      sub: `about ${formatMoney(earnMonthly)}/mo more — log it with the + as money in when it lands`,
    });
    const sortedCards = [...state.cards]
      .filter((c) => Math.floor(c.limit - c.balance) > 0)
      .sort((a, b) => effectiveApr(a, today) - effectiveApr(b, today));
    for (const c of sortedCards) {
      const cardEff = effectiveApr(c, today);
      const promoEndIso = c.promoEnd;
      const promoLive = cardEff === 0 && promoEndIso != null;
      const promoEnd = promoLive
        ? new Date(promoEndIso + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          })
        : null;
      // Priced as if this card were the one chosen, so each row quotes what it
      // would really carry rather than what is left over after the card the
      // user happens to have selected already took its share.
      const cardFin = evaluate({...input, cardId: c.id}, state, months, today, c).financed;
      const cardInterest =
        cardEff === 0 ? 0 : Math.ceil(((cardFin * cardEff) / 100) * (months / 24));
      levers.push({
        kind: 'card',
        id: c.id,
        title: `Put the rest on ${c.name} · ${promoLive ? `0% until ${promoEnd}` : `${c.apr}% APR`}`,
        sub:
          cardEff === 0
            ? `≈${formatMoney(cardFin)} financed · $0 interest if cleared before the promo ends`
            : `≈${formatMoney(cardInterest)} interest over ${months} mo`,
      });
    }
    if (state.cards.length === 0) {
      levers.push({
        kind: 'add-cards',
        id: 'add-cards',
        title: 'Add your cards to see credit options',
        sub: 'Cards tab — APR, limit, balance off the statement',
      });
    }
  }

  const parts: string[] = [];
  if (freed > 0) parts.push(`${formatMoney(freed)}/pay freed from paused wishes`);
  if (financed > 0) parts.push(`${formatMoney(financed)} on ${card?.name ?? ''}`);
  // Name the constraint that is actually binding, and end on the move that
  // clears it. "Pick another lever" is not advice when the levers left cannot
  // reach; the term that works is.
  const hint =
    minViableMonths != null
      ? `stretch it to ${minViableMonths} months`
      : 'free up more or aim lower';
  const gapLine = covered
    ? `Covered ✓${parts.length ? ' · ' + parts.join(' · ') : ''}`
    : !sustainable
      ? `Still ${formatMoney(remainingGap)} short every paycheck — that leaves you ${formatMoney(projection.effectivePerDay, false)}/day. Now ${hint}`
      : `The money is there, but this leaves you ${formatMoney(-projection.safe)} short before payday — ${hint}`;

  const ctaLabel = isNecessity && levers.length > 0 ? 'Lock this plan in' : 'Start this plan';
  // A wish that sinks the day is no more worth starting than a necessity that
  // does, so both are held to the same bar.
  const ctaEnabled = input.name.trim().length > 0 && input.target > 0 && covered;

  return {
    perPaycheck: per,
    free,
    spare,
    cap,
    initialGap,
    over,
    freed,
    remainingGap,
    financed,
    interest,
    totalCost,
    earnMonthly,
    projection,
    solvent,
    sustainable,
    minViableMonths,
    promoCliff: cliff,
    covered,
    perLine,
    perColor,
    levers,
    gapLine,
    ctaLabel,
    ctaEnabled,
  };
}

/** A per-paycheck set-aside spread over the days that paycheck has to cover. */
function perDayDelta(per: number, cadence: Cadence): number {
  return Math.round(per / cycleDays(cadence));
}

/**
 * The spare balance no longer appears here as something a recurring set-aside
 * can be paid out of. It is a one-off: it can absorb a shortfall this cycle,
 * but quoting it as headroom for every cycle is what made "fits, thanks to the
 * $4,565 spare in your balance" a reassuring way to say the daily number was
 * about to go negative.
 */
function buildPerLine(
  kind: 'wish' | 'necessity',
  per: number,
  cap: number,
  over: boolean,
  initialGap: number,
  cadence: Cadence,
): string {
  const perF = `$${Math.round(per)}`;
  const capF = `$${Math.round(cap)}`;
  if (kind === 'wish') {
    if (over) {
      return `That's ${perF} per paycheck — ${capF} is all a cycle can spare without your daily number going negative. Pick a later month.`;
    }
    return `That's ${perF} per paycheck — about $${perDayDelta(per, cadence)}/day less to spend.`;
  }
  if (!over) {
    return `That's ${perF} per paycheck — it fits, and your daily number stays positive.`;
  }
  return `${perF} per paycheck needed — $${Math.round(initialGap)} more than a cycle can spare without your daily number going negative. Find it below ↓`;
}
