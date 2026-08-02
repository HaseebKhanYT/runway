import {describe, expect, it} from 'vitest';
import {demoData} from '../src/demo-data';

const TODAY = new Date('2026-07-16T12:00:00');

describe('demoData', () => {
  it('matches the catalog seed', () => {
    const state = demoData(TODAY);
    expect(state.bills).toHaveLength(7);
    expect(state.cats).toHaveLength(6);
    expect(state.txns).toHaveLength(14);
    expect(state.goals).toHaveLength(2);
    expect(state.cards).toHaveLength(2);
    expect(state.profile.primaryBalance).toBe(6000);
    expect(state.profile.payAmount).toBe(1700);
    expect(state.cats.find((c) => c.locked)?.name).toBe('Uncategorized');
    expect(state.bills.find((b) => b.id === 'spotify')?.paid).toBe(true);
  });
});
