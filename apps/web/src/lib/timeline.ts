import {daysUntil, type Bill} from '@runway/shared';
import {formatMoney, formatShortDate} from './format';

export interface TimelineNode {
  id: string;
  off: number;
  pct: number;
  side: 'above' | 'below';
  payday?: true;
}

/**
 * The desktop rail's design width in px, and the width of a bill's label box on
 * it. The push-apart floors below are sized against the pair: the 13% same-side
 * floor exists to clear the label box at the design width, i.e.
 * `0.13 * RAIL_MIN_WIDTH > LABEL_BOX_WIDTH` (119.6px against 100px). Both live
 * here rather than in the component so that relationship is stated once and
 * cannot drift between the two files that depend on it.
 */
export const RAIL_MIN_WIDTH = 920;
export const LABEL_BOX_WIDTH = 100;

/**
 * Two-pass timeline layout (catalog §3.4): position by date along 9–91% of the
 * rail, push apart (7% any neighbour, 13% same side), then compress back if the
 * chain overran the rail. Payday sorts last on a tie and always sits below.
 *
 * The compression cannot be dropped — every position in the component is a
 * percentage (rail line at 2.5%/97.5%, Today at 3%, nodes at `left: pct%`), so
 * `pct` has to stay inside 9..91. But it multiplies every gap by `k < 1`, which
 * divides the same-side floor back below the label box and overlaps labels past
 * ~14 unpaid bills. So the rail grows with its nodes instead of the floors being
 * compressed away: `railWidth` is `RAIL_MIN_WIDTH` scaled by `1 / k`, the width
 * at which the compressed percentages land on the physical spacing the floors
 * were designed for, and the parent's `overflowX: auto` absorbs the extra
 * length. It is exactly `RAIL_MIN_WIDTH` whenever the chain did not overrun.
 *
 * Bill positions are derived from `today` — the same clock `daysToPayday` came
 * from — so a bill and the payday marker can never be laid out a day apart.
 */
export function layoutTimeline(
  bills: Bill[],
  daysToPayday: number,
  today: Date,
  fadingIds: ReadonlySet<string> = new Set(),
): {nodes: TimelineNode[]; railWidth: number} {
  const future = bills
    .map((b) => ({bill: b, off: daysUntil(b.dueDate, today)}))
    .filter(({bill, off}) => off >= 0 && (!bill.paid || fadingIds.has(bill.id)))
    .sort((a, b) => a.off - b.off);
  const maxOff = Math.max(daysToPayday, ...future.map((b) => b.off), 1);

  const unsorted: TimelineNode[] = [
    ...future.map(({bill, off}): TimelineNode => ({id: bill.id, off, pct: 0, side: 'above'})),
    {id: 'payday', off: daysToPayday, pct: 0, side: 'below', payday: true},
  ];
  const events = unsorted.sort((a, b) => a.off - b.off || (a.payday ? 1 : -1));

  let billIdx = 0;
  let prevAny = -99;
  const prevSide: Record<'above' | 'below', number> = {above: -99, below: -99};
  for (const ev of events) {
    const side: 'above' | 'below' = ev.payday ? 'below' : billIdx++ % 2 === 0 ? 'above' : 'below';
    let p = 9 + (ev.off / maxOff) * 82;
    if (p < prevAny + 7) p = prevAny + 7;
    if (p < prevSide[side] + 13) p = prevSide[side] + 13;
    prevAny = p;
    prevSide[side] = p;
    ev.pct = p;
    (ev as TimelineNode).side = side;
  }

  const last = events[events.length - 1];
  let railWidth = RAIL_MIN_WIDTH;
  if (last && last.pct > 91) {
    const k = (91 - 9) / (last.pct - 9);
    for (const ev of events) ev.pct = 9 + (ev.pct - 9) * k;
    railWidth = RAIL_MIN_WIDTH / k;
  }
  return {nodes: events, railWidth};
}

/**
 * Accessible name for a bill's node on the rail. The dot's only content is a
 * check glyph, so without this every node computes the same name. Amount and
 * date belong in the name because two bills may share one.
 */
export function billNodeLabel(bill: Bill, today: Date): string {
  const money = formatMoney(bill.amount);
  const when = formatShortDate(daysUntil(bill.dueDate, today), today);
  // A paid bill reaches the rail only while it fades, and the wrapper has
  // already killed its pointer events — its name must promise no action.
  return bill.paid
    ? `${bill.name} — paid, ${money}, ${when}`
    : `Pay ${bill.name}, ${money}, due ${when}`;
}

/** Accessible name for the payday node, whose dot has no content at all. */
export function paydayNodeLabel(payAmountF: string, paydayLabel: string): string {
  return `Confirm payday, +${payAmountF} on ${paydayLabel}`;
}

/** Mobile spine spacing: proportional to real day gaps, clamped (catalog §3.4). */
export function spineGap(gapDays: number): number {
  return Math.round(Math.min(82, Math.max(16, gapDays * 7)));
}
