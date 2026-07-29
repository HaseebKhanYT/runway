import type {Bill} from './types';

export interface TimelineNode {
  id: string;
  off: number;
  pct: number;
  side: 'above' | 'below';
  payday?: true;
}

/**
 * Two-pass timeline layout (catalog §3.4): position by date along 9–91% of the
 * rail, push apart (7% any neighbour, 13% same side), then compress back if the
 * chain overran the rail. Payday sorts last on a tie and always sits below.
 */
export function layoutTimeline(
  bills: Bill[],
  DAYS: number,
  fadingIds: ReadonlySet<string> = new Set(),
): {nodes: TimelineNode[]} {
  const future = bills
    .filter((b) => b.off >= 0 && (!b.paid || fadingIds.has(b.id)))
    .sort((a, b) => a.off - b.off);
  const maxOff = Math.max(DAYS, ...future.map((b) => b.off), 1);

  const unsorted: TimelineNode[] = [
    ...future.map((b): TimelineNode => ({id: b.id, off: b.off, pct: 0, side: 'above'})),
    {id: 'payday', off: DAYS, pct: 0, side: 'below', payday: true},
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
  if (last && last.pct > 91) {
    const k = (91 - 9) / (last.pct - 9);
    for (const ev of events) ev.pct = 9 + (ev.pct - 9) * k;
  }
  return {nodes: events};
}

/** Mobile spine spacing: proportional to real day gaps, clamped (catalog §3.4). */
export function spineGap(gapDays: number): number {
  return Math.round(Math.min(82, Math.max(16, gapDays * 7)));
}
