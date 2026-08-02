import {
  effApr,
  goalPer,
  type AppState,
  type Card,
  type Goal,
  type RunwaySummary,
} from '@runway/shared';
import {fm} from './format';

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
  kind: 'pause' | 'card' | 'earn' | 'add-cards';
  id: string;
  title: string;
  sub: string;
}

export interface PlanSummary {
  per: number;
  free: number;
  spare: number;
  sparePer: number;
  cap: number;
  gap0: number;
  over: boolean;
  cushioned: boolean;
  freed: number;
  remGap: number;
  financed: number;
  interest: number;
  covered: boolean;
  perLine: string;
  perColor: string;
  levers: PlanLever[];
  gapLine: string;
  ctaLabel: string;
  ctaEnabled: boolean;
}

const PAYCHECKS_PER_MONTH = 2;

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
  const gap0 = per - cap;
  const over = per > cap;
  const cushioned = per > free && !over;

  const cadence = state.profile.cadence;
  const pausableWishes = state.goals.filter(
    (g) => !g.necessity && !g.paused && g.saved < g.target && goalPer(g, cadence, today) > 0,
  );
  const freed = pausableWishes
    .filter((g) => input.pausedIds.includes(g.id))
    .reduce((sum, g) => sum + goalPer(g, cadence, today), 0);
  const remGap = Math.max(0, gap0 - freed);

  const card: Card | undefined = input.cardId
    ? state.cards.find((c) => c.id === input.cardId)
    : undefined;
  const financed = card
    ? Math.min(
        Math.ceil(remGap * months * PAYCHECKS_PER_MONTH),
        Math.floor(card.limit - card.balance),
        Math.ceil(input.target),
      )
    : 0;
  const eff = card ? effApr(card, today) : 0;
  const interest = eff === 0 ? 0 : Math.ceil(((financed * eff) / 100) * (months / 24));

  const covered =
    gap0 <= 0 ||
    remGap <= 0 ||
    (!!card && financed >= Math.ceil(remGap * months * PAYCHECKS_PER_MONTH) - 1) ||
    input.earn;

  const isNecessity = input.kind === 'necessity';
  const perLine = buildPerLine(input.kind, per, free, spare, over, cushioned, gap0);
  const perColor = isNecessity
    ? over && !covered
      ? '#c2410c'
      : '#2e7d4f'
    : over
      ? '#c2410c'
      : '#8b6fd8';

  const levers: PlanLever[] = [];
  if (isNecessity && gap0 > 0) {
    for (const g of pausableWishes) {
      levers.push({
        kind: 'pause',
        id: g.id,
        title: `Pause “${g.name}” set-asides`,
        sub: `frees ${fm(goalPer(g, cadence, today))} / paycheck while this plan runs`,
      });
    }
    const sortedCards = [...state.cards]
      .filter((c) => Math.floor(c.limit - c.balance) > 0)
      .sort((a, b) => effApr(a, today) - effApr(b, today));
    for (const c of sortedCards) {
      const cardEff = effApr(c, today);
      const promoEndIso = c.promoEnd;
      const promoLive = cardEff === 0 && promoEndIso != null;
      const promoEnd = promoLive
        ? new Date(promoEndIso + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          })
        : null;
      const cardFin = Math.min(
        Math.ceil(remGap * months * PAYCHECKS_PER_MONTH),
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
            ? `≈${fm(cardFin)} financed · $0 interest if cleared before the promo ends`
            : `≈${fm(cardInterest)} interest over ${months} mo`,
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
    const earnMonthly = Math.ceil((remGap * PAYCHECKS_PER_MONTH) / 10) * 10;
    levers.push({
      kind: 'earn',
      id: 'earn',
      title: 'Earn the rest',
      sub: `about ${fm(earnMonthly)}/mo more — log it with the + as money in when it lands`,
    });
  }

  const parts: string[] = [];
  if (freed > 0) parts.push(`${fm(freed)}/pay freed from paused wishes`);
  if (financed > 0) parts.push(`${fm(financed)} on ${card?.name ?? ''}`);
  const gapLine = covered
    ? `Covered ✓${parts.length ? ' · ' + parts.join(' · ') : ''}`
    : `Still short ${fm(remGap)} per paycheck — pick another lever`;

  const ctaLabel = isNecessity && gap0 > 0 ? 'Lock this plan in' : 'Start this plan';
  const ctaEnabled =
    input.name.trim().length > 0 && input.target > 0 && (isNecessity ? covered : !over);

  return {
    per,
    free,
    spare,
    sparePer,
    cap,
    gap0,
    over,
    cushioned,
    freed,
    remGap,
    financed,
    interest,
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
  gap0: number,
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
  return `${perF} per paycheck needed — $${Math.round(gap0)} more than your cycles + ${spareF} spare balance can free up. Find it below ↓`;
}
