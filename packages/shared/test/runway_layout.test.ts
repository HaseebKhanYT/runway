import {describe, expect, it} from 'vitest';
import {layoutTimeline, spineGap} from '../src/runway_layout';
import type {Bill} from '../src/types';

function makeBill(id: string, off: number, paid = false): Bill {
  return {
    id,
    name: id,
    amount: 100,
    kind: 'survival',
    dueDate: '2026-07-19',
    off,
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
    const {nodes} = layoutTimeline(bills, 14);
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
    const {nodes} = layoutTimeline(bills, 14);
    expect(nodes.map((n) => n.id)).toEqual(['due', 'payday']);
  });

  it('compresses crowded chains back into the rail', () => {
    const bills = Array.from({length: 10}, (_, i) => makeBill(`b${i}`, 13));
    const {nodes} = layoutTimeline(bills, 14);
    expect(Math.max(...nodes.map((n) => n.pct))).toBeLessThanOrEqual(91.000001);
  });
});

describe('spineGap', () => {
  it('clamps proportional spacing', () => {
    expect(spineGap(0)).toBe(16);
    expect(spineGap(3)).toBe(21);
    expect(spineGap(30)).toBe(82);
  });
});
