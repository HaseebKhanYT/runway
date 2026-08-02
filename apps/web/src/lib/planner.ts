import {
  cardPaymentDue,
  computeRunway,
  daysUntil,
  effectiveApr,
  goalPerPaycheck,
  type AppState,
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
  sparePer: number;
  cap: number;
  initialGap: number;
  over: boolean;
  cushioned: boolean;
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
  promoCliff: PromoCliff | null;
  covered: boolean;
  perLine: string;
  perColor: string;
  levers: PlanLever[];
  gapLine: string;
  ctaLabel: string;
  ctaEnabled: boolean;
}

const PAYCHECKS_PER_MONTH = 2;
const MONTHS_PER_EXTENSION = 6;

/** Local-parts ISO date, matching how the server stamps a plan's due date. */
function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
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
): AppState {
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
  const planned: Goal = {
    id: '__planned',
    name: input.name || 'This plan',
    target: input.target,
    saved: financed,
    per: Math.max(0, Math.ceil((input.target - financed) / (months * PAYCHECKS_PER_MONTH))),
    note: '',
    due: isoLocal(due),
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

  return {...state, cards, bills, goals};
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
  const per = input.target / (months * PAYCHECKS_PER_MONTH);
  const free = Math.max(0, runway.cycleSurplus);
  const spare = Math.max(0, runway.safe);
  const sparePer = spare / (months * PAYCHECKS_PER_MONTH);
  const cap = free + sparePer;
  const initialGap = per - cap;
  const over = per > cap;
  const cushioned = per > free && !over;

  const cadence = state.profile.cadence;
  const pausableWishes = state.goals.filter(
    (g) =>
      !g.necessity && !g.paused && g.saved < g.target && goalPerPaycheck(g, cadence, today) > 0,
  );
  const freed = pausableWishes
    .filter((g) => input.pausedIds.includes(g.id))
    .reduce((sum, g) => sum + goalPerPaycheck(g, cadence, today), 0);
  const remainingGap = Math.max(0, initialGap - freed);

  const card: Card | undefined = input.cardId
    ? state.cards.find((c) => c.id === input.cardId)
    : undefined;
  const financed = card
    ? Math.min(
        Math.ceil(remainingGap * months * PAYCHECKS_PER_MONTH),
        Math.floor(card.limit - card.balance),
        Math.ceil(input.target),
      )
    : 0;
  const {interest, cliff} = planInterest(card, financed, months, today);
  const totalCost = financed + interest;
  // The figure the "Earn the rest" lever quotes, hoisted out of the lever list
  // so the same number can be sent to the server and recorded on the plan.
  const earnMonthly = Math.ceil((remainingGap * PAYCHECKS_PER_MONTH) / 10) * 10;

  const after = computeRunway(projectState(input, state, financed, months, today), today);
  const projection = {
    safe: after.safe,
    cycleSurplus: after.cycleSurplus,
    effectivePerDay: after.effectivePerDay,
  };
  // Solvency, not merely sourcing. A card lever can always "find" the money;
  // whether the runway survives it is a different question, and it is the one
  // that decides whether locking the plan in lands on the crunch panel (#37).
  //
  // The bar is `safe`, the number the crunch panel reads, and deliberately not
  // `cycleSurplus`. A plan that leans on the spare balance drives cycleSurplus
  // negative by design — that is the `cushioned` state the planner already
  // names on screen ("fits, thanks to the $X spare in your balance"). Blocking
  // it would contradict the product and would reject every plan a spare
  // balance is there to make possible. Borrowing cannot raise cycleSurplus
  // either, since an installment is a new monthly outgoing, so gating on it
  // would quietly retire the card lever altogether. It is surfaced instead.
  const solvent = projection.safe >= 0;
  const sustainable = projection.cycleSurplus >= 0;

  const moneyFound =
    initialGap <= 0 ||
    remainingGap <= 0 ||
    (!!card && financed >= Math.ceil(remainingGap * months * PAYCHECKS_PER_MONTH) - 1) ||
    input.earn;
  const covered = moneyFound && solvent;

  const isNecessity = input.kind === 'necessity';
  const perLine = buildPerLine(input.kind, per, free, spare, over, cushioned, initialGap);
  const perColor = isNecessity
    ? over && !covered
      ? '#c2410c'
      : '#2e7d4f'
    : over
      ? '#c2410c'
      : '#8b6fd8';

  const levers: PlanLever[] = [];
  // Levers appear whenever the plan does not stand up — a plan that sources
  // its money but wrecks the runway needs them just as much as one that is
  // short, and without them the CTA would sit disabled with no way forward.
  if (isNecessity && (initialGap > 0 || !solvent)) {
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
    const longer = months + MONTHS_PER_EXTENSION;
    levers.push({
      kind: 'extend',
      id: 'extend',
      months: longer,
      title: `Give it ${MONTHS_PER_EXTENSION} more months`,
      sub: `${formatMoney(input.target / (longer * PAYCHECKS_PER_MONTH))} per paycheck instead of ${formatMoney(per)} — no interest, no paused wishes`,
    });
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
      const cardFin = Math.min(
        Math.ceil(remainingGap * months * PAYCHECKS_PER_MONTH),
        Math.floor(c.limit - c.balance),
        Math.ceil(input.target),
      );
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
  const gapLine = covered
    ? `Covered ✓${parts.length ? ' · ' + parts.join(' · ') : ''}${
        sustainable ? '' : ' — but it leans on your spare balance, not your paycheck'
      }`
    : !moneyFound
      ? `Still short ${formatMoney(remainingGap)} per paycheck — pick another lever`
      : `The money is there, but this leaves you ${formatMoney(-projection.safe)} short before payday — stretch the term or free up more`;

  const ctaLabel = isNecessity && levers.length > 0 ? 'Lock this plan in' : 'Start this plan';
  const ctaEnabled =
    input.name.trim().length > 0 && input.target > 0 && (isNecessity ? covered : !over);

  return {
    perPaycheck: per,
    free,
    spare,
    sparePer,
    cap,
    initialGap,
    over,
    cushioned,
    freed,
    remainingGap,
    financed,
    interest,
    totalCost,
    earnMonthly,
    projection,
    solvent,
    sustainable,
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

function perDayDelta(per: number): number {
  return Math.round(per / 14);
}

function buildPerLine(
  kind: 'wish' | 'necessity',
  per: number,
  free: number,
  spare: number,
  over: boolean,
  cushioned: boolean,
  initialGap: number,
): string {
  const perF = `$${Math.round(per)}`;
  const freeF = `$${Math.round(free)}`;
  const spareF = `$${Math.round(spare)}`;
  if (kind === 'wish') {
    if (over) {
      return `That's ${perF} per paycheck — more than the ${freeF} each cycle can free up, even counting the ${spareF} spare in your balance. Pick a later month.`;
    }
    if (cushioned) {
      return `That's ${perF} per paycheck — your ${spareF} spare balance covers what the cycles can't. About $${perDayDelta(per)}/day less to spend.`;
    }
    return `That's ${perF} per paycheck — about $${perDayDelta(per)}/day less to spend.`;
  }
  if (!over && cushioned) {
    return `That's ${perF} per paycheck — fits, thanks to the ${spareF} spare in your balance.`;
  }
  if (!over) {
    return `That's ${perF} per paycheck — it fits without denting your daily number.`;
  }
  return `${perF} per paycheck needed — $${Math.round(initialGap)} more than your cycles + ${spareF} spare balance can free up. Find it below ↓`;
}
