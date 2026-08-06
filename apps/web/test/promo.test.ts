import type {Card} from '@runway/shared';
import {describe, expect, it} from 'vitest';
import {livePromo} from '../src/lib/promo';

const TODAY = new Date('2026-07-16T12:00:00');

function makeCard(partial: Partial<Card>): Card {
  return {
    id: 'c1',
    name: 'Card A',
    apr: 21.9,
    limit: 3500,
    balance: 1240,
    dueDay: null,
    minPay: null,
    payInFull: false,
    planInstallment: 0,
    planMonthsLeft: 0,
    rewards: [],
    promoRate: null,
    promoEnd: null,
    balanceUpdatedAt: '2026-07-16T00:00:00.000Z',
    ...partial,
  };
}

describe('livePromo', () => {
  it('reports no promotion on a card that never had one', () => {
    expect(livePromo(makeCard({}), TODAY)).toBeNull();
  });

  it('reports no promotion once the window has closed', () => {
    expect(livePromo(makeCard({promoRate: 0, promoEnd: '2026-06-01'}), TODAY)).toBeNull();
  });

  it('reports a live 0% promotion', () => {
    expect(livePromo(makeCard({promoRate: 0, promoEnd: '2026-12-03'}), TODAY)).toEqual({
      rate: 0,
      ends: '2026-12-03',
    });
  });

  it('reports a live promotion that is cheap rather than free', () => {
    // The #25 case. 4.9% is a promotion by every measure that matters — it is
    // what the card charges today and what the cheapest-first sort ordered on.
    expect(livePromo(makeCard({promoRate: 4.9, promoEnd: '2026-12-03'}), TODAY)).toEqual({
      rate: 4.9,
      ends: '2026-12-03',
    });
  });

  it('reports no promotion when the promotional rate is the standard rate', () => {
    expect(livePromo(makeCard({apr: 21.9, promoRate: 21.9, promoEnd: '2026-12-03'}), TODAY)).toBe(
      null,
    );
  });

  it('reports no promotion when a rate carries no end date', () => {
    expect(livePromo(makeCard({promoRate: 4.9, promoEnd: null}), TODAY)).toBeNull();
  });
});
