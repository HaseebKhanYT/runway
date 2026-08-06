import {computeRunway, demoData, type AppState} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {computeCrunch} from '../src/lib/crunch';

const TODAY = new Date('2026-07-16T12:00:00');

function crunchState(): AppState {
  const state = demoData(TODAY);
  state.profile.primaryBalance = 500;
  return state;
}

describe('computeCrunch', () => {
  it('identifies the breaking bill and orders levers cheapest first', () => {
    const state = crunchState();
    const runway = computeRunway(state, TODAY);
    const crunch = computeCrunch(state, runway, {pausedGoalIds: [], cardId: null}, TODAY);
    expect(crunch.on).toBe(true);
    expect(crunch.billLine).toBe('Not enough for Rent ($950.00, due Jul 19)');
    expect(crunch.goalLevers.map((l) => l.goal.id)).toEqual(['japan', 'efund']);
    // Card B has 0% promo -> sorts before Card A
    expect(crunch.cardLevers.map((l) => l.card.id)).toEqual(['cardb', 'carda']);
    expect(crunch.covered).toBe(false);
  });

  it('covers when levers stack past the shortfall', () => {
    const state = crunchState();
    const runway = computeRunway(state, TODAY);
    const crunch = computeCrunch(
      state,
      runway,
      {pausedGoalIds: ['japan', 'efund'], cardId: 'cardb'},
      TODAY,
    );
    expect(crunch.covered).toBe(true);
    expect(crunch.gapLine).toMatch(/^Covered ✓ · /);
    expect(crunch.gapColor).toBe('#7fc79b');
  });

  it('blames the balance when it is already overdrawn and nothing else is owed', () => {
    const state = demoData(TODAY);
    state.profile.primaryBalance = -120;
    state.bills.forEach((b) => (b.paid = true));
    state.goals = [];
    const runway = computeRunway(state, TODAY);
    const crunch = computeCrunch(state, runway, {pausedGoalIds: [], cardId: null}, TODAY);
    expect(crunch.on).toBe(true);
    // With no goals at all, the old fallback still said "set-asides" (#90).
    expect(crunch.billLine).toBe('Your balance is already $120.00 below zero');
    expect(crunch.billLine).not.toContain('set-asides');
    for (const b of state.bills) expect(crunch.billLine).not.toContain(b.name);
    expect(crunch.goalLevers).toEqual([]);
  });

  it('blames the balance, not the first bill, when overdrawn with bills still due', () => {
    const state = demoData(TODAY);
    state.profile.primaryBalance = -120;
    const runway = computeRunway(state, TODAY);
    const crunch = computeCrunch(state, runway, {pausedGoalIds: [], cardId: null}, TODAY);
    expect(crunch.on).toBe(true);
    // Rent is only the first bill the walk reaches; it broke nothing.
    expect(crunch.billLine).toBe('Your balance is already $120.00 below zero');
    expect(crunch.billLine).not.toContain('Not enough for Rent');
  });

  it('names a live promotional rate and prices the advance at it', () => {
    // 4.9% is a promotion, and it is the rate this advance would be billed at.
    // Testing for 0% labelled the card with the 21.9% it reverts to and
    // charged the advance at that rate too (#25).
    const state = crunchState();
    state.cards = state.cards.map((c) => (c.id === 'cardb' ? {...c, promoRate: 4.9} : c));
    const runway = computeRunway(state, TODAY);
    const crunch = computeCrunch(state, runway, {pausedGoalIds: [], cardId: null}, TODAY);
    const lever = crunch.cardLevers.find((l) => l.card.id === 'cardb');
    expect(lever?.title).toBe('Cover the rest with Card B · 4.9% promo');
    // $911 short, all of it inside Card B's headroom: round(911 × 4.9 / 1200).
    expect(crunch.remainingShort).toBe(911);
    expect(lever?.sub).toBe('≈$4.00/mo interest until you clear it');
  });

  it('blames the set-asides when the balance covers every bill due before payday', () => {
    const state = demoData(TODAY);
    state.profile.primaryBalance = 100;
    state.bills.forEach((b) => (b.paid = true));
    const runway = computeRunway(state, TODAY);
    const crunch = computeCrunch(state, runway, {pausedGoalIds: [], cardId: null}, TODAY);
    expect(crunch.on).toBe(true);
    expect(runway.setAside).toBeGreaterThan(0);
    expect(crunch.billLine).toBe('Your set-asides put you under for this cycle');
  });
});
