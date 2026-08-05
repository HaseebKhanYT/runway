import {effectiveApr, type Card} from '@runway/shared';

/** A promotional rate that is still running today. */
export interface LivePromo {
  /** What the card charges while the promotion lasts — not always 0%. */
  rate: number;
  /** ISO date the promotional rate stops applying. */
  ends: string;
}

/**
 * Whether a card is on a promotion right now, and at what rate.
 *
 * Derived from `effectiveApr` rather than re-reading the promo dates, because
 * `effectiveApr` is what the cheapest-first lever sorts on. Deriving is what
 * makes it impossible for a lever to be ordered by one rate and labelled with
 * another — which is how a live 4.9% promotion came to be announced as the
 * 21.9% it reverts to (#25). It also keeps this clear of #23: when the promo
 * expiry boundary is corrected in `effectiveApr`, this inherits the fix.
 *
 * A promotion at the card's standard rate reads as no promotion. Nothing is
 * being promoted, every figure is already right, and saying so would be noise.
 */
export function livePromo(c: Card, today: Date): LivePromo | null {
  const eff = effectiveApr(c, today);
  return c.promoEnd != null && eff !== c.apr ? {rate: eff, ends: c.promoEnd} : null;
}
