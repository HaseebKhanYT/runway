import {computeRunway, demoData} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {computePlan} from '../src/lib/planner';

const TODAY = new Date('2026-07-16T12:00:00');

function plan(overrides: Partial<Parameters<typeof computePlan>[0]> = {}) {
  const state = demoData(TODAY);
  const runway = computeRunway(state, TODAY);
  return computePlan(
    {
      name: 'Test plan',
      target: 280,
      months: 2,
      kind: 'wish',
      pausedIds: [],
      cardId: null,
      earn: false,
      ...overrides,
    },
    state,
    runway,
    TODAY,
  );
}

describe('computePlan', () => {
  it('fits a small wish inside the demo seed spare balance', () => {
    const summary = plan();
    // 280 over 2 months = 4 paychecks
    expect(summary.per).toBe(70);
    expect(summary.over).toBe(false);
    expect(summary.covered).toBe(true);
    expect(summary.levers).toEqual([]);
    expect(summary.ctaLabel).toBe('Start this plan');
    expect(summary.ctaEnabled).toBe(true);
    expect(summary.perLine).toContain('per paycheck');
  });

  it('offers pause, card (cheapest first), and earn levers for an oversized necessity', () => {
    const summary = plan({target: 8000, months: 1, kind: 'necessity'});
    expect(summary.per).toBe(4000);
    expect(summary.over).toBe(true);
    expect(summary.covered).toBe(false);
    // Both demo goals are unpaused wishes; Card B's 0% promo sorts before Card A
    expect(summary.levers.map((l) => l.kind)).toEqual(['pause', 'pause', 'card', 'card', 'earn']);
    expect(summary.levers.map((l) => l.id)).toEqual(['japan', 'efund', 'cardb', 'carda', 'earn']);
    expect(summary.gapLine).toMatch(/^Still short /);
    expect(summary.ctaLabel).toBe('Lock this plan in');
    expect(summary.ctaEnabled).toBe(false);
  });

  it('marks the plan covered once the earn lever is taken', () => {
    const summary = plan({target: 8000, months: 1, kind: 'necessity', earn: true});
    expect(summary.covered).toBe(true);
    expect(summary.gapLine).toMatch(/^Covered ✓/);
    expect(summary.ctaEnabled).toBe(true);
  });
});
