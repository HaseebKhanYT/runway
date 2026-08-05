import {describe, expect, it} from 'vitest';
import type {Bill} from '@runway/shared';
import {
  billNodeLabel,
  LABEL_BOX_WIDTH,
  layoutTimeline,
  paydayNodeLabel,
  RAIL_MIN_WIDTH,
  spineGap,
} from '../src/lib/timeline';

const TODAY = new Date('2026-07-16T12:00:00');

/** ISO date `off` days after TODAY — the rail derives offsets, so bills carry dates. */
function dueIn(off: number): string {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + off);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function makeBill(id: string, off: number, paid = false): Bill {
  return {
    id,
    name: id,
    amount: 100,
    kind: 'survival',
    dueDate: dueIn(off),
    cycle: 'monthly',
    paid,
    payFrom: null,
    cardId: null,
    oneTime: false,
    personal: false,
    lender: null,
  };
}

describe('layoutTimeline', () => {
  it('positions nodes in 9..91, spaced, payday below and last on tie', () => {
    const bills = [3, 7, 8, 9, 11, 13].map((off, i) => makeBill(`b${i}`, off));
    const {nodes} = layoutTimeline(bills, 14, TODAY);
    expect(nodes).toHaveLength(7);
    const payday = nodes[nodes.length - 1];
    expect(payday.payday).toBe(true);
    expect(payday.side).toBe('below');
    for (const n of nodes) {
      expect(n.pct).toBeGreaterThanOrEqual(9);
      expect(n.pct).toBeLessThanOrEqual(91.000001);
    }
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].pct - nodes[i - 1].pct).toBeGreaterThanOrEqual(0);
    }
    // bills alternate above/below in date order
    const billNodes = nodes.filter((n) => !n.payday);
    billNodes.forEach((n, i) => {
      expect(n.side).toBe(i % 2 === 0 ? 'above' : 'below');
    });
  });

  it('excludes past and paid bills (unless fading)', () => {
    const bills = [makeBill('past', -2), makeBill('paid', 4, true), makeBill('due', 6)];
    const {nodes} = layoutTimeline(bills, 14, TODAY);
    expect(nodes.map((n) => n.id)).toEqual(['due', 'payday']);
  });

  it('compresses crowded chains back into the rail', () => {
    const bills = Array.from({length: 10}, (_, i) => makeBill(`b${i}`, 13));
    const {nodes} = layoutTimeline(bills, 14, TODAY);
    expect(Math.max(...nodes.map((n) => n.pct))).toBeLessThanOrEqual(91.000001);
  });

  it('leaves the rail at its design width when the chain fits', () => {
    // Three bills spread across the cycle clear every floor where their dates
    // put them, so nothing is compressed and nothing renders differently.
    const bills = [3, 7, 11].map((off, i) => makeBill(`b${i}`, off));
    expect(layoutTimeline(bills, 14, TODAY).railWidth).toBe(RAIL_MIN_WIDTH);
  });

  it('widens the rail so a compressed chain keeps its physical spacing', () => {
    // The percentages are compressed to stay in 9..91, so the floors survive
    // only if the rail they are measured against grows by the same factor.
    for (const count of [14, 20, 30]) {
      const bills = Array.from({length: count}, (_, i) =>
        makeBill(`b${i}`, Math.round((i * 13) / (count - 1))),
      );
      const {nodes, railWidth} = layoutTimeline(bills, 14, TODAY);

      const lastOnSide: Record<'above' | 'below', number | null> = {above: null, below: null};
      let minNeighbour = Infinity;
      let minSameSide = Infinity;
      let prevX: number | null = null;
      for (const n of nodes) {
        const x = (n.pct / 100) * railWidth;
        if (prevX !== null) minNeighbour = Math.min(minNeighbour, x - prevX);
        const prevSideX = lastOnSide[n.side];
        if (prevSideX !== null) minSameSide = Math.min(minSameSide, x - prevSideX);
        prevX = x;
        lastOnSide[n.side] = x;
      }

      expect(minSameSide, `same-side gap in px at ${count} bills`).toBeGreaterThanOrEqual(
        LABEL_BOX_WIDTH - 1e-6,
      );
      expect(minNeighbour, `neighbour gap in px at ${count} bills`).toBeGreaterThanOrEqual(
        0.07 * RAIL_MIN_WIDTH - 1e-6,
      );
      expect(railWidth, `rail width at ${count} bills`).toBeGreaterThan(RAIL_MIN_WIDTH);
    }
  });

  it('leaves the rail at its design width with no bills at all', () => {
    const {nodes, railWidth} = layoutTimeline([], 14, TODAY);
    expect(nodes.map((n) => n.id)).toEqual(['payday']);
    expect(railWidth).toBe(RAIL_MIN_WIDTH);
  });
});

describe('billNodeLabel', () => {
  it('names an unpaid bill by action, amount and due date', () => {
    const bill = {...makeBill('b1', 5), name: 'Rent', amount: 1450};
    expect(billNodeLabel(bill, TODAY)).toBe('Pay Rent, $1,450.00, due Jul 21');
  });

  it('promises no action for a paid bill fading off the rail', () => {
    const bill = {...makeBill('b1', 5, true), name: 'Rent', amount: 1450};
    expect(billNodeLabel(bill, TODAY)).toBe('Rent — paid, $1,450.00, Jul 21');
  });

  it('tells apart two bills sharing a name', () => {
    const a = {...makeBill('b1', 2), name: 'Card A payment', amount: 120};
    const b = {...makeBill('b2', 9), name: 'Card A payment', amount: 45};
    expect(billNodeLabel(a, TODAY)).not.toBe(billNodeLabel(b, TODAY));
  });
});

describe('paydayNodeLabel', () => {
  it('states the action, the amount and the date', () => {
    expect(paydayNodeLabel('$2,400.00', 'Aug 1')).toBe('Confirm payday, +$2,400.00 on Aug 1');
  });
});

describe('spineGap', () => {
  it('clamps proportional spacing', () => {
    expect(spineGap(0)).toBe(16);
    expect(spineGap(3)).toBe(21);
    expect(spineGap(30)).toBe(82);
  });
});
